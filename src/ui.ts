import type Graph from 'graphology';
import type { NodeAttributes, EdgeAttributes, DOMElements } from './types';

/**
 * Get DOM element by ID with type safety
 */
export function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element with id '${id}' not found`);
  }
  return element as T;
}

/**
 * Initialize and return all DOM element references
 */
export function getDOMElements(): DOMElements {
  return {
    loading: getElement('loading'),
    sigmaContainer: getElement('sigma-container'),
    searchInput: getElement<HTMLInputElement>('search-input'),
    searchResults: getElement('search-results'),
    filterInput: getElement<HTMLTextAreaElement>('filter-input'),
    btnApply: getElement<HTMLButtonElement>('btn-apply'),
    btnClear: getElement<HTMLButtonElement>('btn-clear'),
    packageList: getElement('package-list'),
    infoPanel: getElement('info-panel'),
    modeBadge: getElement('mode-badge'),
    statNodes: getElement('stat-nodes'),
    statEdges: getElement('stat-edges'),
    pkgCount: getElement('pkg-count'),
    infoName: getElement('info-name'),
    infoDeps: getElement('info-deps'),
    infoRdeps: getElement('info-rdeps'),
    infoDepsList: getElement('info-deps-list'),
    infoDepsSection: getElement('info-deps-section'),
    modeText: getElement('mode-text'),
    zoomIn: getElement<HTMLButtonElement>('zoom-in'),
    zoomOut: getElement<HTMLButtonElement>('zoom-out'),
    zoomFit: getElement<HTMLButtonElement>('zoom-fit'),
    zoomReset: getElement<HTMLButtonElement>('zoom-reset')
  };
}

/**
 * Show/hide loading overlay
 */
export function showLoading(dom: DOMElements, show: boolean, text = 'Loading...'): void {
  dom.loading.classList.toggle('active', show);
  const loadingText = dom.loading.querySelector('.loading-text');
  if (loadingText) {
    loadingText.textContent = text;
  }
}

/**
 * Update graph statistics
 */
export function updateStats(
  dom: DOMElements,
  graph: Graph<NodeAttributes, EdgeAttributes>
): void {
  dom.statNodes.textContent = graph.order.toLocaleString();
  dom.statEdges.textContent = graph.size.toLocaleString();
}

/**
 * Show info panel for selected node
 */
export function showInfoPanel(
  dom: DOMElements,
  nodeId: string,
  deps: string[],
  rdeps: string[],
  onDepClick: (pkg: string) => void
): void {
  dom.infoName.textContent = nodeId;
  dom.infoDeps.textContent = deps.length.toString();
  dom.infoRdeps.textContent = rdeps.length.toString();

  if (deps.length > 0) {
    dom.infoDepsList.innerHTML = deps.slice(0, 10).map(d =>
      `<span class="info-dep-tag" data-pkg="${d}">${d}</span>`
    ).join('') + (deps.length > 10 ? `<span class="info-dep-tag">+${deps.length - 10} more</span>` : '');

    dom.infoDepsSection.style.display = 'block';

    // Attach click handlers
    dom.infoDepsList.querySelectorAll<HTMLElement>('.info-dep-tag[data-pkg]').forEach(el => {
      el.onclick = () => {
        const pkg = el.dataset.pkg;
        if (pkg) onDepClick(pkg);
      };
    });
  } else {
    dom.infoDepsSection.style.display = 'none';
  }

  dom.infoPanel.classList.add('visible');
}

/**
 * Hide info panel
 */
export function hideInfoPanel(dom: DOMElements): void {
  dom.infoPanel.classList.remove('visible');
}

/**
 * Render package list in sidebar
 */
export function renderPackageList(
  dom: DOMElements,
  allPackages: string[],
  graph: Graph<NodeAttributes, EdgeAttributes>,
  onPackageClick: (pkg: string) => void
): void {
  const html = allPackages.slice(0, 500).map(pkg => {
    const deps = graph.outDegree(pkg);
    return `<div class="pkg-item" data-pkg="${pkg}">
        <div class="pkg-dot"></div>
        <span>${pkg}</span>
        <span class="pkg-meta">${deps}</span>
    </div>`;
  }).join('');

  dom.packageList.innerHTML = html;
  dom.pkgCount.textContent = `${allPackages.length} total`;

  // Attach click handlers
  dom.packageList.querySelectorAll<HTMLElement>('.pkg-item').forEach(el => {
    el.onclick = () => {
      const pkg = el.dataset.pkg;
      if (pkg) onPackageClick(pkg);
    };
  });
}

/**
 * Highlight packages in the sidebar list
 */
export function highlightPackagesInList(
  dom: DOMElements,
  nodeSet: Set<string>
): void {
  dom.packageList.querySelectorAll<HTMLElement>('.pkg-item').forEach(el => {
    const pkg = el.dataset.pkg;
    el.classList.toggle('highlighted', pkg ? nodeSet.has(pkg) : false);
  });
}

/**
 * Show subgraph mode badge
 */
export function showModeBadge(
  dom: DOMElements,
  packageCount: number,
  edgeCount: number
): void {
  dom.modeBadge.classList.add('visible');
  dom.modeText.textContent = `Subgraph: ${packageCount} packages, ${edgeCount} edges`;
}

/**
 * Hide subgraph mode badge
 */
export function hideModeBadge(dom: DOMElements): void {
  dom.modeBadge.classList.remove('visible');
}
