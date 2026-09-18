import * as THREE from 'three';

/**
 * 实验室玻璃统一材质。
 *
 * 目标不是“完全透明”，而是：
 * - 能看出玻璃厚度与折射；
 * - 有明显的高光和边缘反射；
 * - 在深色仪器架前仍能一眼辨认；
 * - 避免 transparent + depthWrite:false 带来的排序闪烁。
 */
export function createGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    // 接近无色硼硅玻璃，只保留非常轻的冷色调。
    color: new THREE.Color('#e8f6fa'),
    metalness: 0,
    roughness: 0.055,

    // 不做“隐形玻璃”：保留约 1/3 的实体感。
    transmission: 0.68,
    opacity: 1,
    transparent: false,

    // 常见玻璃折射率。
    ior: 1.5,
    thickness: 0.008,

    // 轻微青蓝吸收，让厚边比中心更明显。
    attenuationColor: new THREE.Color('#b8dce5'),
    attenuationDistance: 0.62,

    // 强化实验室灯光下的镜面高光。
    clearcoat: 1,
    clearcoatRoughness: 0.045,
    specularIntensity: 1,
    specularColor: new THREE.Color('#ffffff'),
    envMapIntensity: 1.9,

    // GLB 已经有器皿厚度，不需要 DoubleSide 再叠一层透明面。
    side: THREE.FrontSide,
    depthWrite: true,
  });
}
