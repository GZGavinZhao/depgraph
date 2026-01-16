# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DepGraph is a package dependency graph visualizer built with TypeScript, Vite, Graphology, and Sigma.js. It renders interactive dependency graphs using WebGL, allowing users to explore package relationships through search, filtering, and visual analysis.

## Development Commands

```bash
# Start development server with hot-reloading at http://localhost:5173
pnpm dev

# Type-check TypeScript and build for production
pnpm build

# Preview production build locally
pnpm preview
```

## Architecture

### Module Structure

The codebase follows a functional, state-based architecture with clear separation of concerns:

- **main.ts**: Application entry point. Creates global `AppState`, orchestrates initialization flow (load data → create graph → compute layout → initialize renderer → setup interactions).

- **types.ts**: Central type definitions for the entire application. Defines `AppState` (the single source of truth for app state), `GraphData`, `NodeAttributes`, `EdgeAttributes`, and `DOMElements`.

- **graph.ts**: Graph creation and layout logic. Contains `loadGraphData()` (currently mock generator), `createGraph()` (builds Graphology instance), and `runForceLayout()` (force-directed layout algorithm).

- **ui.ts**: Pure UI functions that don't manage state. Functions take `dom` and data as parameters, return nothing or update DOM. Includes `getDOMElements()`, `showLoading()`, `updateStats()`, `renderPackageList()`, etc.

- **interactions.ts**: Event handlers and state mutations. All functions that modify `AppState` live here: `selectNode()`, `clearSelection()`, `focusOnNode()`, `handleSearch()`, `applySubgraphFilter()`, `clearSubgraphMode()`. Also contains `setupInteractions()` which wires all event listeners.

### State Management Pattern

The application uses a single mutable `AppState` object defined in `main.ts`. State is modified by functions in `interactions.ts`, which take `state` as their first parameter. This pattern keeps state mutations explicit and traceable.

**Key state properties:**
- `graph`: Graphology instance containing nodes/edges
- `sigma`: Sigma.js renderer instance
- `isSubgraphMode`: Determines whether subgraph filtering is active (affects click behavior)
- `highlightedNodes`: Set of currently highlighted node IDs
- `selectedNode`: Currently selected node ID (null if none)

### Graph Data Flow

1. **Loading**: `loadGraphData()` returns `GraphData` (nodes array + edges array)
2. **Creation**: `createGraph()` converts to Graphology instance with positioned nodes
3. **Layout**: `runForceLayout()` applies force-directed algorithm to optimize positions
4. **Rendering**: Sigma.js renders the Graphology graph using WebGL
5. **Updates**: State mutations trigger attribute updates on graph/edges, then `sigma.refresh()`

### Visual State System

The visualizer uses a color-coding system (defined in `COLORS` constant) to indicate node/edge states:
- **Default**: Gray nodes and edges
- **Highlight**: Cyan for selected nodes and their dependents
- **Path**: Orange for dependencies (outgoing edges)
- **Dimmed**: Very dark for non-connected nodes when selection is active

When nodes are selected or subgraph mode is active, the code updates `color`, `size`, and `hidden` attributes on graph nodes/edges, then calls `sigma.refresh()` to re-render.

### Data Loading

`loadGraphData()` in `graph.ts` currently generates mock data. To integrate real data:
- Replace the function body with: `return await fetch('/api/graph').then(r => r.json())`
- Ensure the API returns `{ nodes: [{ id: string, isBase?: boolean }], edges: [{ source: string, target: string }] }`
- Edge direction: `source` depends on `target`

## TypeScript Configuration

The project uses strict TypeScript with additional safety checks enabled:
- `noUncheckedIndexedAccess`: Array/object access returns `T | undefined`
- `noUnusedLocals` and `noUnusedParameters`: Enforce cleanup
- Vite bundler mode with `noEmit` (type-checking only)

When adding new features that modify graph state, add the state properties to `AppState` interface first, then implement the mutation logic in `interactions.ts`.
