import * as THREE from 'three';

export function calculatePowderPourRateGPerSec(
  tiltRad: number,
  remainingMassG: number,
  maxRateGPerSec = 0.46,
): number {
  if (remainingMassG <= 0) return 0;
  const angle = Math.abs(tiltRad);
  const response = THREE.MathUtils.smoothstep(
    angle,
    THREE.MathUtils.degToRad(24),
    THREE.MathUtils.degToRad(74),
  );
  const lowMassFactor = THREE.MathUtils.clamp(remainingMassG / 0.16, 0.22, 1);
  return maxRateGPerSec * response * lowMassFactor;
}

export function calculateScoopRateGPerSec(pressure01: number, remainingBottleMassG: number): number {
  if (remainingBottleMassG <= 0) return 0;
  const p = THREE.MathUtils.clamp(pressure01, 0, 1);
  return THREE.MathUtils.lerp(0, 0.52, p * p * (3 - 2 * p));
}

export function transferMass(sourceG: number, requestedG: number) {
  const transferredG = Math.max(0, Math.min(sourceG, requestedG));
  return { transferredG, remainingG: sourceG - transferredG };
}
