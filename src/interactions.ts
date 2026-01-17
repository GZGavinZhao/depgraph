import type Sigma from 'sigma';
import type Graph from 'graphology';
import type { NodeAttributes, EdgeAttributes, AppState, DOMElements } from './types';
import { COLORS } from './graph';
import { showInfoPanel, hideInfoPanel, highlightPackagesInList, showModeBadge, hideModeBadge, renderCyclesList, showCyclesModeBadge, initializeTabs } from './ui';
import { loadCyclesMockData, findMatchingScenario, validateScenario, classifyNodes } from './cycles';
import { setupParticleCanvas, initializeParticleSystem, startParticleAnimation, stopParticleAnimation } from './particles';

/**
 * Select a node and highlight its dependencies
 */
export function selectNode(
  state: AppState,
  dom: DOMElements,
  nodeId: string,
  focusOnNodeFn: (nodeId: string) => void
): void {
  if (!state.graph || !state.sigma) return;

  state.selectedNode = nodeId;

  // Get dependencies and dependents
  const deps = state.graph.outNeighbors(nodeId); // packages this depends on
  const rdeps = state.graph.inNeighbors(nodeId); // packages that depend on this
  const connected = new Set([nodeId, ...deps, ...rdeps]);

  // Update node colors
  state.graph.forEachNode((node, attrs) => {
    if (node === nodeId) {
      state.graph!.setNodeAttribute(node, 'color', COLORS.nodeHighlight);
      state.graph!.setNodeAttribute(node, 'size', attrs.originalSize * 1.5);
    } else if (deps.includes(node)) {
      state.graph!.setNodeAttribute(node, 'color', COLORS.nodePath);
      state.graph!.setNodeAttribute(node, 'size', attrs.originalSize * 1.2);
    } else if (rdeps.includes(node)) {
      state.graph!.setNodeAttribute(node, 'color', COLORS.nodeHighlight);
      state.graph!.setNodeAttribute(node, 'size', attrs.originalSize * 1.1);
    } else {
      state.graph!.setNodeAttribute(node, 'color', COLORS.nodeDimmed);
      state.graph!.setNodeAttribute(node, 'size', attrs.originalSize);
    }
  });

  // Update edge colors
  state.graph.forEachEdge((edge, attrs, source, target) => {
    if (source === nodeId || target === nodeId) {
      state.graph!.setEdgeAttribute(edge, 'color', source === nodeId ? COLORS.edgePath : COLORS.edgeHighlight);
      state.graph!.setEdgeAttribute(edge, 'size', 1.5);
    } else {
      state.graph!.setEdgeAttribute(edge, 'color', COLORS.edgeDimmed);
      state.graph!.setEdgeAttribute(edge, 'size', 0.3);
    }
  });

  state.sigma.refresh();

  // Update UI
  showInfoPanel(dom, nodeId, deps, rdeps, focusOnNodeFn);
  highlightPackagesInList(dom, connected);
}

/**
 * Clear node selection
 */
export function clearSelection(state: AppState, dom: DOMElements): void {
  if (state.isSubgraphMode || !state.graph || !state.sigma) return;

  state.selectedNode = null;

  state.graph.forEachNode((node, attrs) => {
    state.graph!.setNodeAttribute(node, 'color', attrs.originalColor);
    state.graph!.setNodeAttribute(node, 'size', attrs.originalSize);
  });

  state.graph.forEachEdge((edge, attrs) => {
    state.graph!.setEdgeAttribute(edge, 'color', attrs.originalColor);
    state.graph!.setEdgeAttribute(edge, 'size', 0.5);
  });

  state.sigma.refresh();
  hideInfoPanel(dom);
  highlightPackagesInList(dom, new Set());
}

/**
 * Focus camera on a specific node
 */
export function focusOnNode(
  state: AppState,
  nodeId: string,
  selectNodeFn: (nodeId: string) => void
): void {
  if (!state.graph || !state.sigma || !state.graph.hasNode(nodeId)) return;

  selectNodeFn(nodeId);

  const nodeX = state.graph.getNodeAttribute(nodeId, 'x');
  const nodeY = state.graph.getNodeAttribute(nodeId, 'y');

  state.sigma.getCamera().animate({ x: nodeX, y: nodeY, ratio: 0.3 }, { duration: 400 });
}

/**
 * Handle search input
 */
export function handleSearch(
  state: AppState,
  dom: DOMElements,
  focusOnNodeFn: (nodeId: string) => void
): void {
  if (!state.graph) return;

  const query = dom.searchInput.value.toLowerCase().trim();

  if (query.length < 2) {
    dom.searchResults.classList.remove('open');
    return;
  }

  const matches = state.allPackages
    .filter(pkg => pkg.toLowerCase().includes(query))
    .slice(0, 15);

  if (matches.length === 0) {
    dom.searchResults.classList.remove('open');
    return;
  }

  dom.searchResults.innerHTML = matches.map(pkg => {
    const deps = state.graph!.outDegree(pkg);
    return `<div class="search-item" data-pkg="${pkg}">
        ${pkg}<span class="search-item-deps">${deps} deps</span>
    </div>`;
  }).join('');

  dom.searchResults.classList.add('open');

  // Attach click handlers
  dom.searchResults.querySelectorAll<HTMLElement>('.search-item').forEach(el => {
    el.onclick = () => {
      const pkg = el.dataset.pkg;
      if (pkg) {
        focusOnNodeFn(pkg);
        dom.searchInput.value = '';
        dom.searchResults.classList.remove('open');
      }
    };
  });
}

/**
 * Apply subgraph filter
 */
export function applySubgraphFilter(state: AppState, dom: DOMElements): void {
  if (!state.graph || !state.sigma) return;

  // Clear cycles mode if active
  if (state.isCyclesMode) {
    clearCyclesMode(state, dom);
  }

  const text = dom.filterInput.value.trim();
  if (!text) {
    clearSubgraphMode(state, dom);
    return;
  }

  const packages = text.split('\n')
    .map(s => s.trim())
    .filter(s => s && state.graph!.hasNode(s));

  if (packages.length === 0) {
    alert('No valid packages found. Check the names match exactly.');
    return;
  }

  // Expand to 1-hop neighborhood
  const expandedNodes = new Set<string>(packages);

  packages.forEach(pkg => {
    state.graph!.outNeighbors(pkg).forEach(dep => expandedNodes.add(dep));   // dependencies
    state.graph!.inNeighbors(pkg).forEach(rdep => expandedNodes.add(rdep));  // dependents
  });

  state.isSubgraphMode = true;
  state.highlightedNodes = expandedNodes;

  // Find ALL edges connecting any expanded nodes
  const subgraphEdges = new Set<string>();
  state.graph.forEachEdge((edge, attrs, source, target) => {
    if (expandedNodes.has(source) && expandedNodes.has(target)) {
      subgraphEdges.add(edge);
    }
  });

  // Update visuals
  state.graph.forEachNode((node, attrs) => {
    if (expandedNodes.has(node)) {
      state.graph!.setNodeAttribute(node, 'color', COLORS.nodeHighlight);
      state.graph!.setNodeAttribute(node, 'hidden', false);
    } else {
      state.graph!.setNodeAttribute(node, 'color', COLORS.nodeDimmed);
      state.graph!.setNodeAttribute(node, 'hidden', true);
    }
  });

  state.graph.forEachEdge((edge) => {
    if (subgraphEdges.has(edge)) {
      state.graph!.setEdgeAttribute(edge, 'color', COLORS.edgeHighlight);
      state.graph!.setEdgeAttribute(edge, 'size', 1);
      state.graph!.setEdgeAttribute(edge, 'hidden', false);
    } else {
      state.graph!.setEdgeAttribute(edge, 'hidden', true);
    }
  });

  state.sigma.refresh();

  // Update UI with clearer messaging
  showModeBadge(dom, packages.length, subgraphEdges.size);
  dom.modeText.textContent = `Subgraph: ${packages.length} packages + neighbors → ${expandedNodes.size} total, ${subgraphEdges.size} edges`;
  highlightPackagesInList(dom, state.highlightedNodes);
}

/**
 * Clear subgraph filter mode
 */
export function clearSubgraphMode(state: AppState, dom: DOMElements): void {
  if (!state.graph || !state.sigma) return;

  state.isSubgraphMode = false;
  state.highlightedNodes.clear();

  state.graph.forEachNode((node, attrs) => {
    state.graph!.setNodeAttribute(node, 'color', attrs.originalColor);
    state.graph!.setNodeAttribute(node, 'size', attrs.originalSize);
    state.graph!.setNodeAttribute(node, 'hidden', false);
  });

  state.graph.forEachEdge((edge, attrs) => {
    state.graph!.setEdgeAttribute(edge, 'color', attrs.originalColor);
    state.graph!.setEdgeAttribute(edge, 'size', 0.5);
    state.graph!.setEdgeAttribute(edge, 'hidden', false);
  });

  state.sigma.refresh();
  hideModeBadge(dom);
  highlightPackagesInList(dom, new Set());
}

/**
 * Detect cycles using mock data
 */
export async function detectCycles(state: AppState, dom: DOMElements): Promise<void> {
  if (!state.graph || !state.sigma) return;

  // Clear subgraph mode if active
  if (state.isSubgraphMode) {
    clearSubgraphMode(state, dom);
  }

  // Parse queried packages from textarea
  const text = dom.cyclesInput.value.trim();
  if (!text) {
    alert('Please enter package names to detect cycles.');
    return;
  }

  const queriedPackages = text.split('\n')
    .map(s => s.trim())
    .filter(s => s);

  if (queriedPackages.length === 0) {
    alert('No valid packages entered.');
    return;
  }

  // Load mock data
  const cyclesData = await loadCyclesMockData();

  // Find matching scenario
  const scenario = findMatchingScenario(cyclesData, queriedPackages);
  if (!scenario) {
    alert(`No matching cycle scenario found for: ${queriedPackages.join(', ')}\n\nAvailable test scenarios:\n- glibc, gcc, binutils\n- python3, perl, ruby, nodejs\n- systemd, dbus, udev, polkit\n- mesa, llvm`);
    return;
  }

  // Validate scenario against actual graph
  const validation = validateScenario(scenario, new Set(state.allPackages));
  if (!validation.valid) {
    alert(`Scenario validation failed. Missing packages: ${validation.missing.join(', ')}`);
    return;
  }

  // Set cycles mode
  state.isCyclesMode = true;
  state.currentCycleScenario = scenario;
  state.visibleCycles = new Set(scenario.cycles.map(c => c.id));

  // Apply visualization
  applyCycleVisualization(state, dom);

  // Render cycles list
  renderCyclesList(dom, scenario.cycles, state.visibleCycles, (cycleId) => {
    toggleCycleVisibility(state, dom, cycleId);
  });

  // Show mode badge
  showCyclesModeBadge(dom, scenario.queriedPackages.length, scenario.cycles.length);

  // Initialize and start wave animation
  if (!state.animationCanvas) {
    state.animationCanvas = setupParticleCanvas(dom.sigmaContainer);
  }
  state.animationCanvas.style.display = 'block';
  state.waveSystem = initializeParticleSystem(scenario, state.visibleCycles);
  startParticleAnimation(state, dom);
}

/**
 * Apply cycle visualization to graph
 */
export function applyCycleVisualization(state: AppState, dom: DOMElements): void {
  if (!state.graph || !state.sigma || !state.currentCycleScenario) return;

  const scenario = state.currentCycleScenario;
  const { queried, intermediate, cycleMembers } = classifyNodes(scenario);

  // Build a map of cycle members to their colors
  const cycleMemberColors = new Map<string, string>();
  for (const cycle of scenario.cycles) {
    if (!state.visibleCycles.has(cycle.id)) continue;

    for (const node of cycle.nodes) {
      // First cycle's color wins for overlapping nodes
      if (!cycleMemberColors.has(node)) {
        cycleMemberColors.set(node, cycle.color);
      }
    }
  }

  // Build set of visible cycle edges
  const visibleCycleEdges = new Set<string>();
  for (const cycle of scenario.cycles) {
    if (!state.visibleCycles.has(cycle.id)) continue;

    for (const edge of cycle.edges) {
      // Create edge key (both directions since graph might be directed)
      visibleCycleEdges.add(`${edge.from}->${edge.to}`);
    }
  }

  // Color nodes
  state.graph.forEachNode((node, attrs) => {
    if (cycleMemberColors.has(node)) {
      // Cycle member
      state.graph!.setNodeAttribute(node, 'color', cycleMemberColors.get(node)!);
      state.graph!.setNodeAttribute(node, 'size', attrs.originalSize * 1.3);
      state.graph!.setNodeAttribute(node, 'hidden', false);
    } else if (queried.has(node)) {
      // Queried package (not in cycle)
      state.graph!.setNodeAttribute(node, 'color', COLORS.nodeQueried);
      state.graph!.setNodeAttribute(node, 'size', attrs.originalSize * 1.2);
      state.graph!.setNodeAttribute(node, 'hidden', false);
    } else if (intermediate.has(node)) {
      // Intermediate node
      state.graph!.setNodeAttribute(node, 'color', COLORS.nodeIntermediate);
      state.graph!.setNodeAttribute(node, 'size', attrs.originalSize * 1.1);
      state.graph!.setNodeAttribute(node, 'hidden', false);
    } else {
      // Hide everything else
      state.graph!.setNodeAttribute(node, 'color', COLORS.nodeDimmed);
      state.graph!.setNodeAttribute(node, 'hidden', true);
    }
  });

  // Color edges
  state.graph.forEachEdge((edge, attrs, source, target) => {
    const edgeKey = `${source}->${target}`;

    if (visibleCycleEdges.has(edgeKey)) {
      // Get the cycle color for this edge
      let edgeColor = COLORS.edgeHighlight;
      for (const cycle of scenario.cycles) {
        if (!state.visibleCycles.has(cycle.id)) continue;

        const matchingEdge = cycle.edges.find(e => e.from === source && e.to === target);
        if (matchingEdge) {
          edgeColor = cycle.color;
          break;
        }
      }

      state.graph!.setEdgeAttribute(edge, 'color', edgeColor);
      state.graph!.setEdgeAttribute(edge, 'size', 1.5);
      state.graph!.setEdgeAttribute(edge, 'hidden', false);
    } else {
      state.graph!.setEdgeAttribute(edge, 'hidden', true);
    }
  });

  state.sigma.refresh();

  // Highlight nodes in package list
  const allVisibleNodes = new Set([...cycleMemberColors.keys(), ...queried, ...intermediate]);
  highlightPackagesInList(dom, allVisibleNodes);
}

/**
 * Toggle cycle visibility
 */
export function toggleCycleVisibility(state: AppState, dom: DOMElements, cycleId: string): void {
  if (!state.currentCycleScenario) return;

  if (state.visibleCycles.has(cycleId)) {
    state.visibleCycles.delete(cycleId);
  } else {
    state.visibleCycles.add(cycleId);
  }

  // Re-apply visualization
  applyCycleVisualization(state, dom);

  // Re-render cycles list
  renderCyclesList(dom, state.currentCycleScenario.cycles, state.visibleCycles, (id) => {
    toggleCycleVisibility(state, dom, id);
  });

  // Reinitialize waves for visible cycles
  if (state.waveSystem) {
    stopParticleAnimation(state);
    state.waveSystem = initializeParticleSystem(state.currentCycleScenario, state.visibleCycles);
    startParticleAnimation(state, dom);
  }
}

/**
 * Clear cycles mode
 */
export function clearCyclesMode(state: AppState, dom: DOMElements): void {
  if (!state.graph || !state.sigma) return;

  // Stop wave animation
  if (state.waveSystem?.animationId) {
    cancelAnimationFrame(state.waveSystem.animationId);
  }
  if (state.animationCanvas) {
    state.animationCanvas.style.display = 'none';
  }

  // Reset state
  state.isCyclesMode = false;
  state.currentCycleScenario = null;
  state.visibleCycles.clear();
  state.waveSystem = null;

  // Reset graph visuals
  state.graph.forEachNode((node, attrs) => {
    state.graph!.setNodeAttribute(node, 'color', attrs.originalColor);
    state.graph!.setNodeAttribute(node, 'size', attrs.originalSize);
    state.graph!.setNodeAttribute(node, 'hidden', false);
  });

  state.graph.forEachEdge((edge, attrs) => {
    state.graph!.setEdgeAttribute(edge, 'color', attrs.originalColor);
    state.graph!.setEdgeAttribute(edge, 'size', 0.5);
    state.graph!.setEdgeAttribute(edge, 'hidden', false);
  });

  state.sigma.refresh();

  // Clear UI
  hideModeBadge(dom);
  highlightPackagesInList(dom, new Set());
  dom.cyclesList.innerHTML = '';
}

/**
 * Setup all event listeners
 */
export function setupInteractions(
  state: AppState,
  dom: DOMElements,
  selectNodeFn: (nodeId: string) => void,
  focusOnNodeFn: (nodeId: string) => void
): void {
  if (!state.sigma || !state.graph) return;

  const sigmaContainer = dom.sigmaContainer;

  // Node click
  state.sigma.on('clickNode', ({ node }) => {
    selectNodeFn(node);
  });

  // Background click
  state.sigma.on('clickStage', () => {
    if (!state.isSubgraphMode) {
      clearSelection(state, dom);
    }
  });

  // Node hover
  state.sigma.on('enterNode', () => {
    sigmaContainer.style.cursor = 'pointer';
  });

  state.sigma.on('leaveNode', () => {
    sigmaContainer.style.cursor = 'grab';
  });

  // Zoom controls
  dom.zoomIn.onclick = () => {
    const camera = state.sigma!.getCamera();
    camera.animatedZoom({ duration: 200 });
  };

  dom.zoomOut.onclick = () => {
    const camera = state.sigma!.getCamera();
    camera.animatedUnzoom({ duration: 200 });
  };

  dom.zoomFit.onclick = () => {
    const camera = state.sigma!.getCamera();
    camera.animatedReset({ duration: 300 });
  };

  dom.zoomReset.onclick = () => {
    clearSelection(state, dom);
    clearSubgraphMode(state, dom);
    const camera = state.sigma!.getCamera();
    camera.animatedReset({ duration: 300 });
  };

  // Search
  dom.searchInput.addEventListener('input', () => handleSearch(state, dom, focusOnNodeFn));
  dom.searchInput.addEventListener('focus', () => handleSearch(state, dom, focusOnNodeFn));
  document.addEventListener('click', e => {
    if (!(e.target as HTMLElement).closest('.search-wrap')) {
      dom.searchResults.classList.remove('open');
    }
  });

  // Filter buttons
  dom.btnApply.onclick = () => applySubgraphFilter(state, dom);
  dom.btnClear.onclick = () => {
    dom.filterInput.value = '';
    clearSubgraphMode(state, dom);
  };

  // Cycle buttons
  dom.btnDetectCycles.onclick = () => detectCycles(state, dom);
  dom.btnClearCycles.onclick = () => {
    dom.cyclesInput.value = '';
    clearCyclesMode(state, dom);
  };

  // Initialize tabs
  initializeTabs(dom);
}
