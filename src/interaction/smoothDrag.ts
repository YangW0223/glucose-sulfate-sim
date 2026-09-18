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
 * Previously most instruments were moved directly from their shelf position to
 * a fixed operation plane on the first physics frame. That looked like the
 * object disappeared/teleported. Damping the target keeps the whole pickup
 * motion visible and continuous.
 */
export function smoothDragTarget(
  body: RapierRigidBody,
  target: TranslationTarget,
  deltaSeconds: number,
  response = 18,
): TranslationTarget {
  const current = body.translation();
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);

  return {
    x: THREE.MathUtils.damp(current.x, target.x, response, dt),
    y: THREE.MathUtils.damp(current.y, target.y, response, dt),
    z: THREE.MathUtils.damp(current.z, target.z, response, dt),
  };
}
