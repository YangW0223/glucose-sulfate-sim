import * as THREE from 'three';

export function createGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#d9f1f8'),
    transmission: 0.88,
    transparent: true,
    opacity: 0.94,
    roughness: 0.055,
    metalness: 0,
    ior: 1.49,
    thickness: 0.0045,
    attenuationColor: new THREE.Color('#a8d8e8'),
    attenuationDistance: 0.42,
    clearcoat: 0.3,
    clearcoatRoughness: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
