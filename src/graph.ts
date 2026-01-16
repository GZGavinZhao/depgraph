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
 * Load graph data from generated JSON file
 * To regenerate: cd /path/to/autobuild && go run main.go export-json src:/path/to/packages2 ../depgraph/public/graph.json
 */
export async function loadGraphData(): Promise<GraphData> {
  try {
    const response = await fetch('/graph.json');
    if (!response.ok) {
      throw new Error(`Failed to load graph data: ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Error loading graph data:', err);
    console.warn('Falling back to empty graph. Run autobuild export-json to generate graph.json');
    // Return empty graph as fallback
    return { nodes: [], edges: [] };
  }
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
      // Skip if edge between these nodes already exists (duplicate dependencies)
      if (!graph.hasEdge(edge.source, edge.target)) {
        const edgeId = `e${i}`;
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
