import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

interface PlasticwareModelProps {
  url: string;
}

export function PlasticwareModel({ url }: PlasticwareModelProps) {
  const { scene } = useGLTF(url);
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#dce7e9',
        roughness: 0.34,
        transmission: 0.18,
        transparent: false,
        opacity: 1,
        ior: 1.44,
        thickness: 0.012,
        attenuationColor: new THREE.Color('#b9cdd2'),
        attenuationDistance: 0.28,
        clearcoat: 0.14,
        clearcoatRoughness: 0.12,
        side: THREE.FrontSide,
        depthWrite: true,
      }),
    [],
  );
  const openingMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#38545e', roughness: 0.5 }),
    [],
  );
  const edgeMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#38545e',
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  );

  const model = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = object.name.includes('NozzleOpening') ? openingMaterial : bodyMaterial;
      object.castShadow = !object.name.includes('BottleBody');
      object.receiveShadow = false;

      if (!object.name.includes('NozzleOpening')) {
        const edges = new THREE.EdgesGeometry(object.geometry, 42);
        const lines = new THREE.LineSegments(edges, edgeMaterial);
        lines.renderOrder = 18;
        lines.frustumCulled = false;
        lines.raycast = () => null;
        object.add(lines);
      }
    });
    return cloned;
  }, [bodyMaterial, edgeMaterial, openingMaterial, scene]);

  return <primitive object={model} />;
}

useGLTF.preload('/models/wash-bottle-250ml.glb');
