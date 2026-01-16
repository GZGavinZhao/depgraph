import Sigma from 'sigma';
import { EdgeArrowProgram } from 'sigma/rendering';
import { loadGraphData, createGraph, runForceLayout } from './graph';
import { getDOMElements, showLoading, updateStats, renderPackageList } from './ui';
import { setupInteractions, selectNode, focusOnNode } from './interactions';
import type { AppState } from './types';
import './styles.css';

// Application state
const state: AppState = {
  graph: null,
  sigma: null,
  allPackages: [],
  highlightedNodes: new Set(),
  selectedNode: null,
  isSubgraphMode: false
};

/**
 * Initialize the application
 */
async function initGraph(): Promise<void> {
  const dom = getDOMElements();

  showLoading(dom, true, 'Loading graph data...');

  try {
    // Load graph data
    const data = await loadGraphData();
    state.allPackages = data.nodes.map(n => n.id).sort();

    // Create graph
    state.graph = createGraph(data);

    // Run force-directed layout
    showLoading(dom, true, 'Computing layout (this may take 10-20 seconds)...');
    await runForceLayout(state.graph);

    // Initialize Sigma renderer
    showLoading(dom, true, 'Initializing renderer...');

    state.sigma = new Sigma(state.graph, dom.sigmaContainer, {
      minCameraRatio: 0.05,
      maxCameraRatio: 3,
      labelRenderedSizeThreshold: 6,
      labelFont: 'IBM Plex Mono, monospace',
      labelSize: 11,
      labelColor: { color: '#9aa5b1' },
      defaultEdgeType: 'arrow',
      edgeProgramClasses: {
        arrow: EdgeArrowProgram
      },
      edgeReducer: (edge, data) => ({
        ...data,
        hidden: data.hidden || false
      }),
      nodeReducer: (node, data) => ({
        ...data,
        hidden: data.hidden || false
      })
    });

    // Create bound functions for interactions
    const selectNodeBound = (nodeId: string) => selectNode(state, dom, nodeId, focusOnNodeBound);
    const focusOnNodeBound = (nodeId: string) => focusOnNode(state, nodeId, selectNodeBound);

    // Setup event handlers
    setupInteractions(state, dom, selectNodeBound, focusOnNodeBound);

    // Update UI
    updateStats(dom, state.graph);
    renderPackageList(dom, state.allPackages, state.graph, focusOnNodeBound);

  } catch (err) {
    console.error('Failed to initialize graph:', err);
  } finally {
    showLoading(dom, false);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGraph);
} else {
  initGraph();
}
