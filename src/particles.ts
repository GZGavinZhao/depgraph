import type Sigma from 'sigma';
import type Graph from 'graphology';
import type { AppState, CycleScenario, WaveSystem, Wave, NodeAttributes, EdgeAttributes } from './types';

// Wave animation constants
const WAVE_SPEED = 0.8;         // Progress units per second (2.6x faster than old particles)
const WAVE_SPREAD = 0.25;       // Gradient covers 25% of edge length
const WAVES_PER_EDGE = 2;       // Number of waves per cycle edge

/**
 * Setup animation canvas overlay
 */
export function setupAnimationCanvas(sigmaContainer: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';  // Keep ID for CSS compatibility

  // Insert canvas into sigma container
  sigmaContainer.appendChild(canvas);

  // Set canvas size to match container
  resizeAnimationCanvas(canvas, sigmaContainer);

  return canvas;
}

/**
 * Resize animation canvas to match container
 */
export function resizeAnimationCanvas(canvas: HTMLCanvasElement, container: HTMLElement): void {
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
 * Initialize wave system with waves for each visible cycle edge
 */
export function initializeWaveSystem(
  scenario: CycleScenario,
  visibleCycles: Set<string>
): WaveSystem {
  const waves: Wave[] = [];

  for (const cycle of scenario.cycles) {
    if (!visibleCycles.has(cycle.id)) continue;

    // Create multiple waves per edge
    for (let edgeIndex = 0; edgeIndex < cycle.edges.length; edgeIndex++) {
      for (let waveNum = 0; waveNum < WAVES_PER_EDGE; waveNum++) {
        waves.push({
          cycleId: cycle.id,
          edgeIndex,
          centerProgress: waveNum / WAVES_PER_EDGE, // Stagger waves evenly
          color: cycle.color
        });
      }
    }
  }

  return {
    waves,
    lastFrame: performance.now(),
    animationId: null
  };
}

/**
 * Update wave positions based on elapsed time
 */
export function updateWaves(
  system: WaveSystem,
  scenario: CycleScenario
): void {
  const now = performance.now();
  const delta = (now - system.lastFrame) / 1000; // Convert to seconds
  system.lastFrame = now;

  for (const wave of system.waves) {
    // Find the cycle for this wave
    const cycle = scenario.cycles.find(c => c.id === wave.cycleId);
    if (!cycle || cycle.edges.length === 0) continue;

    // Advance wave center position
    wave.centerProgress += WAVE_SPEED * delta;

    // Wrap around when wave reaches end of edge
    if (wave.centerProgress > 1 + WAVE_SPREAD / 2) {
      wave.centerProgress = -WAVE_SPREAD / 2;
    }
  }
}

/**
 * Render waves on canvas
 */
export function renderWaves(
  canvas: HTMLCanvasElement,
  system: WaveSystem,
  scenario: CycleScenario,
  graph: Graph<NodeAttributes, EdgeAttributes>,
  sigma: Sigma<NodeAttributes, EdgeAttributes>
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();

  // Clear canvas
  ctx.clearRect(0, 0, rect.width, rect.height);

  // Render each wave
  for (const wave of system.waves) {
    // Find the cycle for this wave
    const cycle = scenario.cycles.find(c => c.id === wave.cycleId);
    if (!cycle || cycle.edges.length === 0) continue;

    // Get current edge
    const edge = cycle.edges[wave.edgeIndex];
    if (!edge) continue;

    // Get node positions
    if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to)) continue;

    const fromX = graph.getNodeAttribute(edge.from, 'x');
    const fromY = graph.getNodeAttribute(edge.from, 'y');
    const toX = graph.getNodeAttribute(edge.to, 'x');
    const toY = graph.getNodeAttribute(edge.to, 'y');

    // Calculate wave bounds
    const startProgress = Math.max(0, wave.centerProgress - WAVE_SPREAD / 2);
    const endProgress = Math.min(1, wave.centerProgress + WAVE_SPREAD / 2);

    // Skip if wave is completely out of bounds
    if (endProgress <= 0 || startProgress >= 1) continue;

    // Interpolate start and end positions along edge
    const startGraphX = fromX + (toX - fromX) * startProgress;
    const startGraphY = fromY + (toY - fromY) * startProgress;
    const endGraphX = fromX + (toX - fromX) * endProgress;
    const endGraphY = fromY + (toY - fromY) * endProgress;

    // Transform to viewport coordinates
    const startViewport = sigma.graphToViewport({ x: startGraphX, y: startGraphY });
    const endViewport = sigma.graphToViewport({ x: endGraphX, y: endGraphY });

    // Create linear gradient from wave start to end
    const gradient = ctx.createLinearGradient(
      startViewport.x, startViewport.y,
      endViewport.x, endViewport.y
    );

    // Gradient color stops (creates pulse effect)
    gradient.addColorStop(0, wave.color + '00');    // Transparent
    gradient.addColorStop(0.5, wave.color + 'ff');  // Full opacity at center
    gradient.addColorStop(1, wave.color + '00');    // Transparent

    // Draw thick line with gradient
    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = wave.color;

    ctx.beginPath();
    ctx.moveTo(startViewport.x, startViewport.y);
    ctx.lineTo(endViewport.x, endViewport.y);
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Start wave animation loop
 */
export function startWaveAnimation(state: AppState, dom: { sigmaContainer: HTMLElement }): void {
  if (!state.waveSystem || !state.currentCycleScenario || !state.graph || !state.sigma || !state.animationCanvas) return;

  const animate = () => {
    if (!state.waveSystem || !state.currentCycleScenario || !state.graph || !state.sigma || !state.animationCanvas) return;

    updateWaves(state.waveSystem, state.currentCycleScenario);
    renderWaves(state.animationCanvas, state.waveSystem, state.currentCycleScenario, state.graph, state.sigma);

    state.waveSystem.animationId = requestAnimationFrame(animate);
  };

  animate();
}

/**
 * Stop wave animation
 */
export function stopWaveAnimation(state: AppState): void {
  if (state.waveSystem?.animationId) {
    cancelAnimationFrame(state.waveSystem.animationId);
    state.waveSystem.animationId = null;
  }
}

// Legacy exports for backward compatibility (will be updated in other files)
export const setupParticleCanvas = setupAnimationCanvas;
export const resizeParticleCanvas = resizeAnimationCanvas;
export const initializeParticleSystem = initializeWaveSystem;
export const startParticleAnimation = startWaveAnimation;
export const stopParticleAnimation = stopWaveAnimation;
