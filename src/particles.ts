import type Sigma from 'sigma';
import type Graph from 'graphology';
import type { AppState, CycleScenario, ParticleSystem, Particle, NodeAttributes, EdgeAttributes } from './types';

// Particle animation constants
const PARTICLE_SPEED = 0.3; // Progress units per second
const PARTICLES_PER_CYCLE = 3;

/**
 * Setup particle canvas overlay
 */
export function setupParticleCanvas(sigmaContainer: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';

  // Insert canvas into sigma container
  sigmaContainer.appendChild(canvas);

  // Set canvas size to match container
  resizeParticleCanvas(canvas, sigmaContainer);

  return canvas;
}

/**
 * Resize particle canvas to match container
 */
export function resizeParticleCanvas(canvas: HTMLCanvasElement, container: HTMLElement): void {
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Set actual size (accounting for device pixel ratio for sharp rendering)
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // Set display size
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  // Scale context to account for device pixel ratio
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
}

/**
 * Initialize particle system with particles for each visible cycle
 */
export function initializeParticleSystem(
  scenario: CycleScenario,
  visibleCycles: Set<string>
): ParticleSystem {
  const particles: Particle[] = [];

  for (const cycle of scenario.cycles) {
    if (!visibleCycles.has(cycle.id)) continue;

    // Create multiple particles per cycle, staggered
    for (let i = 0; i < PARTICLES_PER_CYCLE; i++) {
      particles.push({
        cycleId: cycle.id,
        edgeIndex: 0,
        progress: i / PARTICLES_PER_CYCLE, // Stagger particles evenly
        color: cycle.color
      });
    }
  }

  return {
    particles,
    lastFrame: performance.now(),
    animationId: null
  };
}

/**
 * Update particle positions based on elapsed time
 */
export function updateParticles(
  system: ParticleSystem,
  scenario: CycleScenario
): void {
  const now = performance.now();
  const delta = (now - system.lastFrame) / 1000; // Convert to seconds
  system.lastFrame = now;

  for (const particle of system.particles) {
    // Find the cycle for this particle
    const cycle = scenario.cycles.find(c => c.id === particle.cycleId);
    if (!cycle || cycle.edges.length === 0) continue;

    // Advance particle progress
    particle.progress += PARTICLE_SPEED * delta;

    // Wrap to next edge when progress >= 1
    while (particle.progress >= 1) {
      particle.progress -= 1;
      particle.edgeIndex = (particle.edgeIndex + 1) % cycle.edges.length;
    }
  }
}

/**
 * Render particles on canvas
 */
export function renderParticles(
  canvas: HTMLCanvasElement,
  system: ParticleSystem,
  scenario: CycleScenario,
  graph: Graph<NodeAttributes, EdgeAttributes>,
  sigma: Sigma<NodeAttributes, EdgeAttributes>
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();

  // Clear canvas
  ctx.clearRect(0, 0, rect.width, rect.height);

  // Render each particle
  for (const particle of system.particles) {
    // Find the cycle for this particle
    const cycle = scenario.cycles.find(c => c.id === particle.cycleId);
    if (!cycle || cycle.edges.length === 0) continue;

    // Get current edge
    const edge = cycle.edges[particle.edgeIndex];
    if (!edge) continue;

    // Get node positions
    if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to)) continue;

    const fromX = graph.getNodeAttribute(edge.from, 'x');
    const fromY = graph.getNodeAttribute(edge.from, 'y');
    const toX = graph.getNodeAttribute(edge.to, 'x');
    const toY = graph.getNodeAttribute(edge.to, 'y');

    // Interpolate position along edge
    const graphX = fromX + (toX - fromX) * particle.progress;
    const graphY = fromY + (toY - fromY) * particle.progress;

    // Transform to viewport coordinates
    const viewportPos = sigma.graphToViewport({ x: graphX, y: graphY });

    // Draw particle with glow effect
    const particleRadius = 4;

    // Outer glow
    ctx.beginPath();
    const gradient = ctx.createRadialGradient(
      viewportPos.x, viewportPos.y, 0,
      viewportPos.x, viewportPos.y, particleRadius * 3
    );
    gradient.addColorStop(0, particle.color + 'aa'); // Semi-transparent
    gradient.addColorStop(0.5, particle.color + '44');
    gradient.addColorStop(1, particle.color + '00'); // Fully transparent
    ctx.fillStyle = gradient;
    ctx.arc(viewportPos.x, viewportPos.y, particleRadius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Inner solid particle
    ctx.beginPath();
    ctx.fillStyle = particle.color;
    ctx.arc(viewportPos.x, viewportPos.y, particleRadius, 0, Math.PI * 2);
    ctx.fill();

    // Bright center
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(viewportPos.x, viewportPos.y, particleRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Start particle animation loop
 */
export function startParticleAnimation(state: AppState, dom: { sigmaContainer: HTMLElement }): void {
  if (!state.particleSystem || !state.currentCycleScenario || !state.graph || !state.sigma || !state.particleCanvas) return;

  const animate = () => {
    if (!state.particleSystem || !state.currentCycleScenario || !state.graph || !state.sigma || !state.particleCanvas) return;

    updateParticles(state.particleSystem, state.currentCycleScenario);
    renderParticles(state.particleCanvas, state.particleSystem, state.currentCycleScenario, state.graph, state.sigma);

    state.particleSystem.animationId = requestAnimationFrame(animate);
  };

  animate();
}

/**
 * Stop particle animation
 */
export function stopParticleAnimation(state: AppState): void {
  if (state.particleSystem?.animationId) {
    cancelAnimationFrame(state.particleSystem.animationId);
    state.particleSystem.animationId = null;
  }
}
