// SPDX-FileCopyrightText: Copyright © 2020-2023 Serpent OS Developers
//
// SPDX-License-Identifier: MPL-2.0

package cmd

import (
	"encoding/json"
	"errors"
	"os"
	"strings"

	"github.com/DataDrake/waterlog"
	st "github.com/GZGavinZhao/autobuild/state"
	"github.com/GZGavinZhao/autobuild/ypkg"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var (
	cmdExportJSON = &cobra.Command{
		Use:   "export-json [src:path] [output]",
		Short: "Export dependency graph as JSON for visualization",
		Long: `Export the package dependency graph as JSON format suitable for web visualization.

For example: autobuild export-json src:../packages2 ../depgraph/public/graph.json

This command parses all packages from the source repository and outputs a JSON file
containing nodes (packages) and edges (dependencies) in a format that can be loaded
by the depgraph web visualization tool.`,
		Run: runExportJSON,
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) < 2 {
				return errors.New("expects two args: source path and output file path")
			}
			return nil
		},
	}
)

type GraphNode struct {
	ID     string `json:"id"`
	IsBase bool   `json:"isBase,omitempty"`
}

type GraphEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

func isBaseComponent(component yaml.Node) bool {
	if component.Kind == yaml.ScalarNode {
		val := strings.ToLower(component.Value)
		return strings.HasPrefix(val, "system.base") || strings.HasPrefix(val, "system.devel")
	} else if component.Kind == yaml.MappingNode {
		// Handle split packages like ^libgcc : system.base
		for _, node := range component.Content {
			if node.Kind == yaml.ScalarNode {
				val := strings.ToLower(node.Value)
				if strings.HasPrefix(val, "system.base") || strings.HasPrefix(val, "system.devel") {
					return true
				}
			}
		}
	}
	return false
}

func runExportJSON(cmd *cobra.Command, args []string) {
	tpath := args[0]
	outputPath := args[1]

	// Load source state
	state, err := st.LoadState(tpath)
	if err != nil {
		waterlog.Fatalf("Failed to parse state: %s\n", err)
	}
	waterlog.Goodln("Successfully parsed state!")

	packages := state.Packages()
	pvdToPkgIdx := state.PvdToPkgIdx()

	// Build nodes and edges
	nodes := make([]GraphNode, 0, len(packages))
	edges := make([]GraphEdge, 0)

	// Track which packages we've seen to avoid duplicates
	seenPackages := make(map[string]bool)

	for _, pkg := range packages {
		// Skip if we've already added this package
		if seenPackages[pkg.Source] {
			continue
		}
		seenPackages[pkg.Source] = true

		// Load package.yml to get component information
		pkgYml, err := ypkg.Load(pkg.Path + "/package.yml")
		isBase := false
		if err == nil {
			isBase = isBaseComponent(pkgYml.Component)
		}

		// Add node
		nodes = append(nodes, GraphNode{
			ID:     pkg.Source,
			IsBase: isBase,
		})

		// Add edges for build dependencies
		for _, dep := range pkg.BuildDeps {
			// Resolve dependency to package index
			depIdx, found := pvdToPkgIdx[dep]
			if !found {
				// Skip dependencies that couldn't be resolved
				continue
			}

			depPkg := packages[depIdx]

			// Skip self-dependencies
			if pkg.Source == depPkg.Source {
				continue
			}

			// Add edge: pkg depends on depPkg
			// Direction: source → target means "source depends on target"
			edges = append(edges, GraphEdge{
				Source: pkg.Source,
				Target: depPkg.Source,
			})
		}
	}

	// Create graph data structure
	graphData := GraphData{
		Nodes: nodes,
		Edges: edges,
	}

	// Marshal to JSON
	jsonData, err := json.MarshalIndent(graphData, "", "  ")
	if err != nil {
		waterlog.Fatalf("Failed to marshal JSON: %s\n", err)
	}

	// Write to file
	err = os.WriteFile(outputPath, jsonData, 0644)
	if err != nil {
		waterlog.Fatalf("Failed to write output file: %s\n", err)
	}

	waterlog.Goodf("Successfully exported graph to %s\n", outputPath)
	waterlog.Goodf("  Nodes: %d packages\n", len(nodes))
	waterlog.Goodf("  Edges: %d dependencies\n", len(edges))
}
