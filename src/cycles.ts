import type { CyclesData, CycleScenario } from './types';

/**
 * Load mock cycle data from JSON file
 */
export async function loadCyclesMockData(): Promise<CyclesData> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}cycles-mock.json`);
    if (!response.ok) {
      throw new Error(`Failed to load cycles mock data: ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Error loading cycles mock data:', err);
    return { scenarios: [] };
  }
}

/**
 * Find a matching scenario based on queried packages
 * Matches if the queried packages match exactly (order doesn't matter)
 */
export function findMatchingScenario(
  data: CyclesData,
  queried: string[]
): CycleScenario | null {
  const queriedSet = new Set(queried);

  for (const scenario of data.scenarios) {
    const scenarioSet = new Set(scenario.queriedPackages);

    // Check if sets are equal
    if (queriedSet.size === scenarioSet.size &&
        [...queriedSet].every(pkg => scenarioSet.has(pkg))) {
      return scenario;
    }
  }

  return null;
}

/**
 * Validate that all nodes and edges in the scenario exist in the graph
 */
export function validateScenario(
  scenario: CycleScenario,
  allPackages: Set<string>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  // Check queried packages
  for (const pkg of scenario.queriedPackages) {
    if (!allPackages.has(pkg)) {
      missing.push(pkg);
    }
  }

  // Check intermediate nodes
  for (const pkg of scenario.intermediateNodes) {
    if (!allPackages.has(pkg)) {
      missing.push(pkg);
    }
  }

  // Check cycle nodes
  for (const cycle of scenario.cycles) {
    for (const node of cycle.nodes) {
      if (!allPackages.has(node)) {
        missing.push(node);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing: [...new Set(missing)] // Remove duplicates
  };
}

/**
 * Classify nodes into queried, intermediate, and cycle members
 */
export function classifyNodes(scenario: CycleScenario): {
  queried: Set<string>;
  intermediate: Set<string>;
  cycleMembers: Set<string>;
} {
  const queried = new Set(scenario.queriedPackages);
  const intermediate = new Set(scenario.intermediateNodes);
  const cycleMembers = new Set<string>();

  // Collect all cycle member nodes
  for (const cycle of scenario.cycles) {
    for (const node of cycle.nodes) {
      cycleMembers.add(node);
    }
  }

  return { queried, intermediate, cycleMembers };
}
