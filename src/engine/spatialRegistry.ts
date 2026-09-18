import * as THREE from 'three';

export interface OpeningTarget {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  radius: number;
  enabled: boolean;
}

export interface SphereTarget {
  center: THREE.Vector3;
  radius: number;
  enabled: boolean;
}

const openingRegistry = new Map<string, OpeningTarget>();
const sphereRegistry = new Map<string, SphereTarget>();

export function updateOpeningTarget(id: string, target: OpeningTarget) {
  const existing = openingRegistry.get(id);
  if (existing) {
    existing.center.copy(target.center);
    existing.normal.copy(target.normal).normalize();
    existing.radius = target.radius;
    existing.enabled = target.enabled;
    return;
  }
  openingRegistry.set(id, {
    center: target.center.clone(),
    normal: target.normal.clone().normalize(),
    radius: target.radius,
    enabled: target.enabled,
  });
}

export function getOpeningTarget(id: string): OpeningTarget | undefined {
  return openingRegistry.get(id);
}

export function updateSphereTarget(id: string, target: SphereTarget) {
  const existing = sphereRegistry.get(id);
  if (existing) {
    existing.center.copy(target.center);
    existing.radius = target.radius;
    existing.enabled = target.enabled;
    return;
  }
  sphereRegistry.set(id, {
    center: target.center.clone(),
    radius: target.radius,
    enabled: target.enabled,
  });
}

export function getSphereTarget(id: string): SphereTarget | undefined {
  return sphereRegistry.get(id);
}
