import * as THREE from 'three';

export interface RimOverflowRateInput {
  headMeters: number;
  tiltRad: number;
  viscosityFactor?: number;
  outletWidthMeters?: number;
}

/**
 * Macroscopic free-surface overflow model.
 * Uses a Torricelli-like velocity term and an effective rim opening area.
 * It is intentionally stable for interactive simulation rather than CFD-grade.
 */
export function calculateRimOverflowRateMlPerSec({
  headMeters,
  tiltRad,
  viscosityFactor = 1,
  outletWidthMeters = 0.007,
}: RimOverflowRateInput): number {
  if (headMeters <= 0) return 0;

  const g = 9.81;
  const dischargeCoefficient = 0.62;
  const velocityMps = Math.sqrt(2 * g * headMeters);
  const wettedHeight = THREE.MathUtils.clamp(headMeters * 0.7, 0.00025, 0.0035);
  const effectiveAreaM2 = outletWidthMeters * wettedHeight;
  const tiltFactor = THREE.MathUtils.smoothstep(Math.abs(tiltRad), THREE.MathUtils.degToRad(35), THREE.MathUtils.degToRad(88));
  const cubicMetersPerSecond = dischargeCoefficient * effectiveAreaM2 * velocityMps * Math.max(0.18, tiltFactor);
  const mlPerSecond = cubicMetersPerSecond * 1_000_000;
  return THREE.MathUtils.clamp(mlPerSecond / viscosityFactor, 0, 58);
}

export function transferVolume(sourceMl: number, requestedMl: number) {
  const transferredMl = Math.max(0, Math.min(sourceMl, requestedMl));
  return {
    transferredMl,
    remainingMl: sourceMl - transferredMl,
  };
}

export interface BallisticStreamInput {
  start: THREE.Vector3;
  velocity: THREE.Vector3;
  gravity?: number;
  maxTime?: number;
  steps?: number;
}

export function sampleBallisticTrajectory({
  start,
  velocity,
  gravity = 9.81,
  maxTime = 0.75,
  steps = 28,
}: BallisticStreamInput): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * maxTime;
    points.push(
      new THREE.Vector3(
        start.x + velocity.x * t,
        start.y + velocity.y * t - 0.5 * gravity * t * t,
        start.z + velocity.z * t,
      ),
    );
  }
  return points;
}

export interface HorizontalOpening {
  center: THREE.Vector3;
  radius: number;
  y: number;
}

/** Solve the ballistic stream crossing of a horizontal opening plane. */
export function findBallisticOpeningHit(
  start: THREE.Vector3,
  velocity: THREE.Vector3,
  opening: HorizontalOpening,
  gravity = 9.81,
): { hit: boolean; point: THREE.Vector3; time: number } | null {
  // y(t) = y0 + vy*t - 1/2*g*t^2 = opening.y
  const a = -0.5 * gravity;
  const b = velocity.y;
  const c = start.y - opening.y;
  const d = b * b - 4 * a * c;
  if (d < 0) return null;

  const roots = [(-b + Math.sqrt(d)) / (2 * a), (-b - Math.sqrt(d)) / (2 * a)]
    .filter((value) => value > 0.002)
    .sort((x, y) => x - y);
  const time = roots[0];
  if (time === undefined || time > 1.5) return null;

  const point = new THREE.Vector3(
    start.x + velocity.x * time,
    opening.y,
    start.z + velocity.z * time,
  );
  const dx = point.x - opening.center.x;
  const dz = point.z - opening.center.z;
  return { hit: dx * dx + dz * dz <= opening.radius * opening.radius, point, time };
}

export interface SqueezeJetRateInput {
  pressure01: number;
  remainingVolumeMl: number;
  maxRateMlPerSec?: number;
}

/** Stable wash-bottle jet model for interactive squeezing. */
export function calculateSqueezeJetRateMlPerSec({
  pressure01,
  remainingVolumeMl,
  maxRateMlPerSec = 24,
}: SqueezeJetRateInput): number {
  if (remainingVolumeMl <= 0) return 0;
  const p = THREE.MathUtils.clamp(pressure01, 0, 1);
  // Slightly nonlinear response: gentle presses are controllable, hard presses ramp quickly.
  const response = p * p * (3 - 2 * p);
  const lowVolumeFactor = THREE.MathUtils.clamp(remainingVolumeMl / 12, 0.25, 1);
  return maxRateMlPerSec * response * lowVolumeFactor;
}


export interface PlaneOpening {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  radius: number;
}

/** Solve a ballistic trajectory against an arbitrarily oriented circular opening plane. */
export function findBallisticPlaneOpeningHit(
  start: THREE.Vector3,
  velocity: THREE.Vector3,
  opening: PlaneOpening,
  gravity = 9.81,
): { hit: boolean; point: THREE.Vector3; time: number } | null {
  const normal = opening.normal.clone().normalize();
  const gravityVector = new THREE.Vector3(0, -gravity, 0);
  // n·(p0 + v*t + 1/2*g*t² - c) = 0
  const a = 0.5 * normal.dot(gravityVector);
  const b = normal.dot(velocity);
  const c = normal.dot(start.clone().sub(opening.center));
  const roots: number[] = [];
  if (Math.abs(a) < 1e-8) {
    if (Math.abs(b) < 1e-8) return null;
    roots.push(-c / b);
  } else {
    const d = b * b - 4 * a * c;
    if (d < 0) return null;
    const sqrtD = Math.sqrt(d);
    roots.push((-b - sqrtD) / (2 * a), (-b + sqrtD) / (2 * a));
  }
  const time = roots.filter((value) => value > 0.002 && value <= 1.5).sort((x, y) => x - y)[0];
  if (time === undefined) return null;

  const point = start
    .clone()
    .addScaledVector(velocity, time)
    .addScaledVector(gravityVector, 0.5 * time * time);
  const offset = point.clone().sub(opening.center);
  const normalDistance = normal.dot(offset);
  offset.addScaledVector(normal, -normalDistance);
  return { hit: offset.lengthSq() <= opening.radius * opening.radius, point, time };
}
