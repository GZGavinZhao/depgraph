import type Graph from 'graphology';
import type Sigma from 'sigma';

// Graph data structures
export interface GraphData {
  nodes: Array<{ id: string; isBase?: boolean }>;
  edges: Array<{ source: string; target: string }>;
}

// Node attributes for Graphology
export interface NodeAttributes {
  x: number;
  y: number;
  size: number;
  color: string;
  label: string;
  isBase: boolean;
  originalColor: string;
  originalSize: number;
  hidden?: boolean;
}

// Edge attributes for Graphology
export interface EdgeAttributes {
  id: string;
  color: string;
  size: number;
  originalColor: string;
  hidden?: boolean;
}

// Application state
export interface AppState {
  graph: Graph<NodeAttributes, EdgeAttributes> | null;
  sigma: Sigma<NodeAttributes, EdgeAttributes> | null;
  allPackages: string[];
  highlightedNodes: Set<string>;
  selectedNode: string | null;
  isSubgraphMode: boolean;
}

// Color palette
export interface ColorPalette {
  nodeDefault: string;
  nodeHighlight: string;
  nodePath: string;
  nodeDimmed: string;
  edgeDefault: string;
  edgeHighlight: string;
  edgePath: string;
  edgeDimmed: string;
}

// DOM element IDs for type safety
export interface DOMElements {
  loading: HTMLElement;
  sigmaContainer: HTMLElement;
  searchInput: HTMLInputElement;
  searchResults: HTMLElement;
  filterInput: HTMLTextAreaElement;
  btnApply: HTMLButtonElement;
  btnClear: HTMLButtonElement;
  packageList: HTMLElement;
  infoPanel: HTMLElement;
  modeBadge: HTMLElement;
  statNodes: HTMLElement;
  statEdges: HTMLElement;
  pkgCount: HTMLElement;
  infoName: HTMLElement;
  infoDeps: HTMLElement;
  infoRdeps: HTMLElement;
  infoDepsList: HTMLElement;
  infoDepsSection: HTMLElement;
  modeText: HTMLElement;
  zoomIn: HTMLButtonElement;
  zoomOut: HTMLButtonElement;
  zoomFit: HTMLButtonElement;
  zoomReset: HTMLButtonElement;
}
