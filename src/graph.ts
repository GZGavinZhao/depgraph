import Graph from 'graphology';
import type { GraphData, NodeAttributes, EdgeAttributes, ColorPalette } from './types';

export const COLORS: ColorPalette = {
  nodeDefault: '#4a5568',
  nodeHighlight: '#22d3ee',
  nodePath: '#fb923c',
  nodeDimmed: '#1e2830',
  edgeDefault: '#2d3748',
  edgeHighlight: '#22d3ee',
  edgePath: '#fb923c',
  edgeDimmed: '#141a20'
};

/**
 * Load graph data
 * Currently returns mock data; can be replaced with API call or file loading
 */
export async function loadGraphData(): Promise<GraphData> {
  // --- SAMPLE DATA GENERATOR ---
  // Replace this with: return await fetch('/api/graph').then(r => r.json());

  const count = 800; // Adjust for testing; your real data has ~5000
  const nodes: GraphData['nodes'] = [];
  const edges: GraphData['edges'] = [];

  // Base/core packages that many things depend on
  const basePackages = [
    'glibc', 'gcc', 'binutils', 'coreutils', 'bash', 'perl', 'python',
    'openssl', 'zlib', 'ncurses', 'readline', 'sqlite', 'libxml2',
    'curl', 'git', 'cmake', 'make', 'autoconf', 'automake', 'libtool',
    'pkg-config', 'gettext', 'glib', 'dbus', 'systemd', 'util-linux',
    'shadow', 'pam', 'acl', 'attr', 'libcap', 'audit', 'selinux'
  ];

  basePackages.forEach(id => nodes.push({ id, isBase: true }));

  // Generate additional packages
  const prefixes = ['lib', 'python-', 'perl-', 'go-', 'rust-', 'node-', ''];
  const names = ['utils', 'core', 'tools', 'common', 'extra', 'data', 'net',
                 'web', 'crypto', 'db', 'gui', 'cli', 'api', 'sdk', 'auth'];

  for (let i = nodes.length; i < count; i++) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const suffix = Math.random() > 0.5 ? Math.floor(Math.random() * 99) : '';
    nodes.push({ id: `${prefix}${name}${suffix}` });
  }

  // Generate dependency edges
  nodes.forEach((pkg, idx) => {
    if (idx < 5) return; // Skip first few base packages
    const depCount = Math.floor(Math.random() * 4) + 1;
    const candidates = nodes.slice(0, idx);

    // Shuffle and pick dependencies, favoring base packages
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(depCount, shuffled.length); i++) {
      if (Math.random() > 0.3 || shuffled[i]?.isBase) {
        edges.push({ source: pkg.id, target: shuffled[i]!.id });
      }
    }
  });

  return { nodes, edges };
}

/**
 * Create and initialize a Graphology graph from data
 */
export function createGraph(data: GraphData): Graph<NodeAttributes, EdgeAttributes> {
  const graph = new Graph<NodeAttributes, EdgeAttributes>();

  const nodeCount = data.nodes.length;
  const radius = Math.sqrt(nodeCount) * 15;

  // Add nodes with initial circular layout
  data.nodes.forEach((node, i) => {
    const angle = (i / nodeCount) * 2 * Math.PI;
    const r = radius * (0.5 + Math.random() * 0.5);

    graph.addNode(node.id, {
      x: Math.cos(angle) * r + (Math.random() - 0.5) * 50,
      y: Math.sin(angle) * r + (Math.random() - 0.5) * 50,
      size: node.isBase ? 8 : 4,
      color: COLORS.nodeDefault,
      label: node.id,
      isBase: node.isBase || false,
      originalColor: COLORS.nodeDefault,
      originalSize: node.isBase ? 8 : 4
    });
  });

  // Add edges
  data.edges.forEach((edge, i) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      const edgeId = `e${i}`;
      if (!graph.hasEdge(edgeId)) {
        graph.addEdge(edge.source, edge.target, {
          id: edgeId,
          color: COLORS.edgeDefault,
          size: 0.5,
          originalColor: COLORS.edgeDefault
        });
      }
    }
  });

  return graph;
}

/**
 * Run force-directed layout algorithm
 */
export async function runForceLayout(
  graph: Graph<NodeAttributes, EdgeAttributes>
): Promise<void> {
  const nodes = graph.nodes();
  const iterations = 100;
  const repulsion = 800;
  const attraction = 0.01;
  const damping = 0.9;

  // Initialize velocities
  const vel: Record<string, { x: number; y: number }> = {};
  nodes.forEach(n => vel[n] = { x: 0, y: 0 });

  for (let iter = 0; iter < iterations; iter++) {
    // Get current positions
    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach(n => {
      positions[n] = {
        x: graph.getNodeAttribute(n, 'x'),
        y: graph.getNodeAttribute(n, 'y')
      };
    });

    // Calculate repulsion forces
    nodes.forEach(n1 => {
      let fx = 0, fy = 0;

      // Sample a subset of nodes for repulsion (performance optimization)
      const sampleSize = Math.min(50, nodes.length);
      const sample = nodes.length <= sampleSize ? nodes :
        nodes.filter(() => Math.random() < sampleSize / nodes.length);

      sample.forEach(n2 => {
        if (n1 === n2) return;
        const pos1 = positions[n1]!;
        const pos2 = positions[n2]!;
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      });

      vel[n1]!.x = (vel[n1]!.x + fx) * damping;
      vel[n1]!.y = (vel[n1]!.y + fy) * damping;
    });

    // Calculate attraction forces along edges
    graph.forEachEdge((edge, attrs, source, target) => {
      const posSource = positions[source]!;
      const posTarget = positions[target]!;
      const dx = posTarget.x - posSource.x;
      const dy = posTarget.y - posSource.y;
      const force = attraction;

      vel[source]!.x += dx * force;
      vel[source]!.y += dy * force;
      vel[target]!.x -= dx * force;
      vel[target]!.y -= dy * force;
    });

    // Apply velocities
    nodes.forEach(n => {
      const pos = positions[n]!;
      const v = vel[n]!;
      graph.setNodeAttribute(n, 'x', pos.x + v.x);
      graph.setNodeAttribute(n, 'y', pos.y + v.y);
    });

    // Yield every 10 iterations to keep UI responsive
    if (iter % 10 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }
}
