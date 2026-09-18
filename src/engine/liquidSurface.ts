import * as THREE from 'three';

type SampleKey = string;
const sampleCache = new Map<SampleKey, Float32Array>();
const yScratchCache = new Map<SampleKey, Float32Array>();

const RADIAL_STEPS = 5;
const ANGULAR_STEPS = 16;
const Y_STEPS = 7;
const BINARY_SEARCH_STEPS = 10;

function buildCylinderSamples(
  radius: number,
  height: number,
  radialSteps = RADIAL_STEPS,
  angularSteps = ANGULAR_STEPS,
  ySteps = Y_STEPS,
) {
  const key = `${radius}:${height}:${radialSteps}:${angularSteps}:${ySteps}`;
  const cached = sampleCache.get(key);
  if (cached) return { samples: cached, key };

  const values: number[] = [];
  // Equal-area radial sampling: r = R * sqrt((i + 0.5) / N)
  for (let yi = 0; yi < ySteps; yi += 1) {
    const y = -height / 2 + ((yi + 0.5) / ySteps) * height;
    for (let ri = 0; ri < radialSteps; ri += 1) {
      const r = radius * Math.sqrt((ri + 0.5) / radialSteps);
      for (let ai = 0; ai < angularSteps; ai += 1) {
        const a = ((ai + (yi % 2) * 0.5) / angularSteps) * Math.PI * 2;
        values.push(Math.cos(a) * r, y, Math.sin(a) * r);
      }
    }
  }

  const samples = new Float32Array(values);
  sampleCache.set(key, samples);
  yScratchCache.set(key, new Float32Array(samples.length / 3));
  return { samples, key };
}

/**
 * Estimate the world-space Y of a horizontal free surface that preserves volume
 * inside a tilted cylindrical cavity.
 *
 * This is intentionally an interactive approximation, not CFD. The sample count
 * is kept modest because several vessels may evaluate the surface at once.
 */
export function calculateCylinderSurfaceWorldY(
  matrixWorld: THREE.Matrix4,
  radius: number,
  height: number,
  fillRatio: number,
): number {
  const clamped = THREE.MathUtils.clamp(fillRatio, 0, 1);
  const { samples, key } = buildCylinderSamples(radius, height);
  const ys = yScratchCache.get(key)!;
  const e = matrixWorld.elements;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let count = 0;
  for (let i = 0; i < samples.length; i += 3) {
    const x = samples[i];
    const y = samples[i + 1];
    const z = samples[i + 2];
    const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
    ys[count++] = wy;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
  }

  if (clamped <= 0) return minY - 0.001;
  if (clamped >= 1) return maxY + 0.001;

  // Binary search the clipping plane using volume samples; avoids per-frame sort.
  let lo = minY;
  let hi = maxY;
  const targetCount = clamped * count;
  for (let iteration = 0; iteration < BINARY_SEARCH_STEPS; iteration += 1) {
    const mid = (lo + hi) / 2;
    let below = 0;
    for (let i = 0; i < count; i += 1) {
      if (ys[i] <= mid) below += 1;
    }
    if (below < targetCount) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function cylinderCapacityMl(radiusM: number, heightM: number): number {
  return Math.PI * radiusM * radiusM * heightM * 1_000_000;
}
