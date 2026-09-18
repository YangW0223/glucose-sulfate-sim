import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

interface RubberwareModelProps {
  url: string;
}

export function RubberwareModel({ url }: RubberwareModelProps) {
  const { scene } = useGLTF(url);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#d96b5f', roughness: 0.82, metalness: 0.02 }),
    [],
  );
  const model = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.material = material;
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return cloned;
  }, [material, scene]);
  return <primitive object={model} />;
}

useGLTF.preload('/models/pipette-bulb.glb');
