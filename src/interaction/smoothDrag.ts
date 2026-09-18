import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

interface TranslationTarget {
  x: number;
  y: number;
  z: number;
}

/**
 * Smooth kinematic movement while an instrument is held.
 *
 * A fairly quick response keeps the instrument visually continuous without
 * making it feel heavy or "stuck" behind the mouse.
 */
export function smoothDragTarget(
  body: RapierRigidBody,
  target: TranslationTarget,
  deltaSeconds: number,
  response = 26,
): TranslationTarget {
  const current = body.translation();
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);

  return {
    x: THREE.MathUtils.damp(current.x, target.x, response, dt),
    y: THREE.MathUtils.damp(current.y, target.y, response, dt),
    z: THREE.MathUtils.damp(current.z, target.z, response, dt),
  };
}
