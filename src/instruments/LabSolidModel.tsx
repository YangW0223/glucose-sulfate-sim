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
    const metal = new THREE.MeshStandardMaterial({ color: '#aebbc2', metalness: 0.68, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: '#354955', metalness: 0.14, roughness: 0.42 });
    const light = new THREE.MeshStandardMaterial({ color: '#eef3f5', metalness: 0.05, roughness: 0.38 });
    const button = new THREE.MeshStandardMaterial({ color: '#2b7698', metalness: 0.08, roughness: 0.35 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#bedee8',
      transmission: 0.72,
      transparent: false,
      opacity: 1,
      roughness: 0.09,
      ior: 1.48,
      thickness: 0.010,
      attenuationColor: new THREE.Color('#7eaebb'),
      attenuationDistance: 0.24,
      clearcoat: 0.35,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.35,
      side: THREE.FrontSide,
      depthWrite: true,
    });
    return { metal, dark, light, button, glass };
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
        object.material = object.name.includes('Rim') ? materials.glass : materials.glass;
      } else {
        object.material = materials.metal;
      }
      const transparentPreset = preset === 'bottle';
      object.castShadow = !transparentPreset;
      object.receiveShadow = !transparentPreset;
    });
    return cloned;
  }, [materials, preset, scene]);

  return <primitive object={model} />;
}

useGLTF.preload('/models/electronic-balance.glb');
useGLTF.preload('/models/glucose-reagent-bottle.glb');
useGLTF.preload('/models/lab-spatula.glb');
