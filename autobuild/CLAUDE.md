# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`autobuild` is a dependency solver and build automation tool for Solus Linux packages. It analyzes package definitions (YPKG `package.yml` or Stone `stone.yaml` files), resolves build dependencies, computes build orders using topological sorting, and can push packages to build servers.

## Building and Running

Build the project:
```bash
go build -buildvcs .
```

Run directly without building:
```bash
go run -buildvcs . <args-to-autobuild>
```

No Makefile or test suite exists in this project.

## Core Commands

### Query
Query the build order for packages:
```bash
autobuild query <tpath> <list-of-packages>
```

Examples:
```bash
# Query build order for ROCm packages
autobuild query src:../packages rocblas hipblas rocsolver hipsolver

# Query all packages (no package list provided)
autobuild query src:../packages
```

Flags:
- `-t, --tiers`: Output tiered build order (packages that can be built in parallel)
- `-F, --forward N`: Include N levels of packages that depend on the list
- `-R, --reverse N`: Include N levels of packages that the list depends on
- `--show-sub`: Show subpackages instead of just recipe names
- `--dot <path>`: Export dependency graph in DOT format

### Diff
Compare two package states:
```bash
autobuild diff <old-tpath> <new-tpath>
```

Example:
```bash
# Compare local changes against unstable repo
autobuild diff repo:unstable src:../packages
```

Flags:
- `-s, --strict`: Show warnings for outdated packages or unbumped release numbers

### Push
Push package changes to the build server (currently mostly stubbed out):
```bash
autobuild push <old-tpath> <new-tpath> [packages-to-push]
```

Flags:
- `-f, --force`: Ignore safety checks
- `-n, --dry-run`: Don't publish (default: true)
- `-p, --push`: Git push packages before publishing (default: true)

## TPath (Typed Path) System

TPaths specify different sources of package information:

1. **Source**: `src:<path>` - Points to directory with YPKG/Stone recipe files
   - Example: `src:/home/user/solus/packages`
   - This is the most common format containing full build dependency info

2. **Binary**: `bin:<path>` - Points to XML index file (uncompressed)
   - Example: `bin:/var/lib/eopkg/index/Unstable/eopkg-index.xml`
   - Must be XML, not xz-compressed

3. **Remote**: `repo:<name>` - Fetches from Solus repositories
   - Example: `repo:unstable`
   - Fetches from `https://packages.getsol.us/<name>/eopkg-index.xml.xz`

## Architecture

### State System (`state/`)

The core abstraction is the `State` interface representing a collection of packages with dependency information:

```go
type State interface {
    Packages() []common.Package
    SrcToPkgIds() map[string][]int
    PvdToPkgIdx() map[string]int
    DepGraph() *graph.Immutable
}
```

Two implementations:
- **SourceState** (`source_state.go`): Walks directories, parses YPKG/Stone files, generates full dependency graphs
- **BinaryState** (`binary_state.go`): Parses eopkg XML indices, primarily for diffing (no full dependency graph)

Key function: `LoadState(tpath string)` - Routes to appropriate loader based on TPath prefix.

### Package Representation (`common/`)

`Package` struct represents both source recipes and their subpackages:
- `Source`: Recipe name (e.g., "rocm-clr")
- `Names`: List of binary package names produced
- `Provides`: Virtual provides including pkgconfig providers
- `BuildDeps`: Resolved build dependencies
- `Ignores`: Regex patterns for dependencies to ignore (from autobuild.yml)

Two package formats supported:
- **YPKG** (`ypkg/yml.go`): Legacy Solus format (`package.yml`)
- **Stone** (`stone/yml.go`): Newer format (`stone.yaml`)

Parsing happens in `common/read.go`. For YPKG, it also reads `pspec_x86_64.xml` (if exists) to get subpackage names and pkgconfig provides.

### Dependency Resolution

Process (in `SourceState.buildGraph()`):
1. Walk directory tree to find package recipes
2. Parse each recipe and extract build dependencies
3. Load `autobuild.yaml`/`autobuild.yml` for ignore patterns
4. Build provider map (`pvdToPkgIdx`) mapping package names and virtual provides to package indices
5. Construct directed graph where edge A→B means "A must be built before B"
6. Apply ignore patterns to drop unnecessary edges

### Build Order Computation

Core algorithm in `state/state.go:QueryOrder()`:
1. Lift subgraph containing only requested packages using `utils.LiftGraph()`
2. Perform tiered topological sort with `utils.TieredTopSort()`
3. Detect cycles using `graph.StrongComponents()` if sort fails
4. For cycles, compute dependency chains to help debug

When cycles occur, the tool reports:
- All packages in each cycle
- A dependency chain showing how the cycle forms (using `utils.LongerShortestPath()`)

### Configuration (`config/`)

Packages can have `autobuild.yaml` or `autobuild.yml`:

```yaml
# Skip this package and subdirectories entirely
ignore: false

solver:
  ignore:
    - <regex-of-dependencies-to-ignore>
```

**Important**: The regex must match the entire package name. Use `haskell.*` not `haskell` to ignore all haskell packages.

### Cycle Breaking Workflow

When cycles are detected, see `process.md` for examples of how to iteratively add ignores to break cycles. Common patterns:
- Documentation generators (doxygen, asciidoc)
- Test frameworks (python-pytest, jtreg)
- Runtime-only dependencies that don't affect build
- Bidirectional dependencies where one direction is only for testing

## Common Development Patterns

When adding features:
- Use `waterlog` for logging (Good/Info/Warn/Error/Fatal levels)
- Leverage `cobra` flags for command options
- Dependency graph operations use `github.com/yourbasic/graph`
- File walking uses `github.com/charlievieth/fastwalk` for performance

When debugging build orders:
- Enable verbose mode: `autobuild -v query ...`
- Use `--dot` to visualize graphs
- Check `waterlog.Debugf()` output for graph hashes and stats
