import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

interface LabSolidModelProps {
  url: string;
  preset?: 'balance' | 'bottle' | 'metal';
}

export function LabSolidModel({ url, preset = 'metal' }: LabSolidModelProps) {
  const { scene } = useGLTF(url);

  const materials = useMemo(() => {
    const metal = new THREE.MeshStandardMaterial({
      color: '#aebbc2',
      metalness: 0.68,
      roughness: 0.3,
    });

    const dark = new THREE.MeshStandardMaterial({
      color: '#354955',
      metalness: 0.14,
      roughness: 0.42,
    });

    const light = new THREE.MeshStandardMaterial({
      color: '#eef3f5',
      metalness: 0.05,
      roughness: 0.38,
    });

    const button = new THREE.MeshStandardMaterial({
      color: '#2b7698',
      metalness: 0.08,
      roughness: 0.35,
    });

    // 葡萄糖试剂瓶使用略带磨砂感的厚玻璃，和量筒/比色管的清玻璃区分。
    const reagentGlass = new THREE.MeshPhysicalMaterial({
      color: '#edf8fa',
      metalness: 0,
      roughness: 0.16,
      transmission: 0.56,
      transparent: false,
      opacity: 1,
      ior: 1.5,
      thickness: 0.012,
      attenuationColor: new THREE.Color('#c2dce2'),
      attenuationDistance: 0.42,
      clearcoat: 0.82,
      clearcoatRoughness: 0.08,
      specularIntensity: 1,
      specularColor: new THREE.Color('#ffffff'),
      envMapIntensity: 1.65,
      side: THREE.FrontSide,
      depthWrite: true,
    });

    return { metal, dark, light, button, reagentGlass };
  }, []);

  const model = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      if (preset === 'balance') {
        if (object.name.includes('Pan')) object.material = materials.metal;
        else if (object.name.includes('TareButton')) object.material = materials.button;
        else if (object.name.includes('Display')) object.material = materials.dark;
        else object.material = materials.light;
      } else if (preset === 'bottle') {
        object.material = materials.reagentGlass;
      } else {
        object.material = materials.metal;
      }

      const glassPreset = preset === 'bottle';
      object.castShadow = !glassPreset;
      object.receiveShadow = !glassPreset;
    });

    return cloned;
  }, [materials, preset, scene]);

  return <primitive object={model} />;
}

useGLTF.preload('/models/electronic-balance.glb');
useGLTF.preload('/models/glucose-reagent-bottle.glb');
useGLTF.preload('/models/lab-spatula.glb');
