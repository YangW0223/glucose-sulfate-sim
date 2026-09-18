import * as THREE from 'three';

/**
 * 玻璃器皿统一材质。
 *
 * 这里刻意避免 `transparent + depthWrite:false + DoubleSide` 的组合：
 * 在多层玻璃、液体、层板同时存在时，这种组合很容易出现深度排序抖动/闪烁。
 * 使用 transmission 负责透光，保持 opacity=1 与 depthWrite=true，使深度关系更稳定。
 */
export function createGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#b9dce7'),
    transmission: 0.76,
    opacity: 1,
    transparent: false,
    roughness: 0.085,
    metalness: 0,
    ior: 1.47,
    thickness: 0.010,
    attenuationColor: new THREE.Color('#79aebe'),
    attenuationDistance: 0.24,
    clearcoat: 0.42,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.45,
    side: THREE.FrontSide,
    depthWrite: true,
  });
}
