import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import type { GraphData, NodeAttributes, EdgeAttributes, ColorPalette } from './types';

export const COLORS: ColorPalette = {
  nodeDefault: '#4a5568',
  nodeHighlight: '#22d3ee',
  nodePath: '#fb923c',
  nodeDimmed: '#1e2830',
  nodeQueried: '#3b82f6',
  nodeIntermediate: '#a78bfa',
  edgeDefault: '#2d3748',
  edgeHighlight: '#22d3ee',
  edgePath: '#fb923c',
  edgeDimmed: '#141a20',
  cyclePalette: ['#f87171', '#a78bfa', '#22d3ee', '#fb923c', '#ec4899']
};

/**
 * Load graph data from generated JSON file
 * To regenerate: cd /path/to/autobuild && go run main.go export-json src:/path/to/packages2 ../depgraph/public/graph.json
 */
export async function loadGraphData(): Promise<GraphData> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}graph.json`);
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
          originalColor: COLORS.edgeDefault,
          type: 'arrow'
        });
      }
    }
  });

  return graph;
}

/**
 * Run ForceAtlas2 layout algorithm optimized for large graphs
 */
export async function runForceLayout(
  graph: Graph<NodeAttributes, EdgeAttributes>
): Promise<void> {
  // Run ForceAtlas2 for better initial layout
  const settings = {
    iterations: 500,
    settings: {
      barnesHutOptimize: true,      // Use Barnes-Hut for O(n log n) performance
      strongGravityMode: false,
      gravity: 0.05,                 // Pull nodes toward center slightly
      scalingRatio: 10,              // Increase space between nodes
      edgeWeightInfluence: 1,        // Consider edge weights
      slowDown: 5,                   // Stabilize faster
      adjustSizes: true,             // Account for node sizes
      linLogMode: false              // Linear attraction, logarithmic repulsion
    }
  };

  forceAtlas2.assign(graph, settings);

  // Apply noverlap to prevent node overlaps
  noverlap.assign(graph, {
    maxIterations: 100,
    settings: {
      ratio: 1.5,                    // How much space between nodes
      margin: 5,                     // Minimum margin
      expansion: 1.2,                // Grid cell expansion
      gridSize: 20,                  // Spatial grid optimization
      speed: 3                       // Adjustment speed
    }
  });
}
