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

// Cycle data structures
export interface CycleEdge {
  from: string;
  to: string;
}

export interface Cycle {
  id: string;
  nodes: string[];
  edges: CycleEdge[];
  color: string;
}

export interface CycleScenario {
  id: string;
  queriedPackages: string[];
  cycles: Cycle[];
  intermediateNodes: string[];
}

export interface CyclesData {
  scenarios: CycleScenario[];
}

// Wave animation structures
export interface Wave {
  cycleId: string;
  edgeIndex: number;
  centerProgress: number;  // 0-1 position along edge
  color: string;
}

export interface WaveSystem {
  waves: Wave[];
  lastFrame: number;
  animationId: number | null;
}

// Application state
export interface AppState {
  graph: Graph<NodeAttributes, EdgeAttributes> | null;
  sigma: Sigma<NodeAttributes, EdgeAttributes> | null;
  allPackages: string[];
  highlightedNodes: Set<string>;
  selectedNode: string | null;
  isSubgraphMode: boolean;
  isCyclesMode: boolean;
  currentCycleScenario: CycleScenario | null;
  visibleCycles: Set<string>;
  waveSystem: WaveSystem | null;
  animationCanvas: HTMLCanvasElement | null;
}

// Color palette
export interface ColorPalette {
  nodeDefault: string;
  nodeHighlight: string;
  nodePath: string;
  nodeDimmed: string;
  nodeQueried: string;
  nodeIntermediate: string;
  edgeDefault: string;
  edgeHighlight: string;
  edgePath: string;
  edgeDimmed: string;
  cyclePalette: string[];
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
  tabSubgraph: HTMLButtonElement;
  tabCycles: HTMLButtonElement;
  subgraphPanel: HTMLElement;
  cyclesPanel: HTMLElement;
  cyclesInput: HTMLTextAreaElement;
  btnDetectCycles: HTMLButtonElement;
  btnClearCycles: HTMLButtonElement;
  cyclesList: HTMLElement;
}
