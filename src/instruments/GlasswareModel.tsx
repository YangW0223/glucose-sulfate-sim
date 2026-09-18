import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { createGlassMaterial } from './GlassMaterial';

interface GlasswareModelProps {
  url: string;
}

/**
 * 玻璃器皿统一渲染。
 *
 * 玻璃主体依赖 PBR transmission / IOR / thickness 表现折射和厚度。
 * 轮廓线只做很轻的结构强调，避免器皿变成“卡通描边”。
 */
export function GlasswareModel({ url }: GlasswareModelProps) {
  const { scene } = useGLTF(url);

  const glassMaterial = useMemo(() => createGlassMaterial(), []);
  const edgeMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#7aa8b6',
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  );

  const model = useMemo(() => {
    const cloned = scene.clone(true);
    const meshes: THREE.Mesh[] = [];

    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });

    for (const mesh of meshes) {
      mesh.material = glassMaterial;

      // 透明/透射玻璃不参与阴影贴图，避免底部出现阴影噪点。
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 4;

      // 只在杯口、底座等较硬的结构边上加非常轻的轮廓。
      const edges = new THREE.EdgesGeometry(mesh.geometry, 42);
      const lines = new THREE.LineSegments(edges, edgeMaterial);
      lines.renderOrder = 20;
      lines.frustumCulled = false;
      lines.raycast = () => null;
      lines.name = `${mesh.name || 'GlassMesh'}__glassRim`;
      mesh.add(lines);
    }

    return cloned;
  }, [edgeMaterial, glassMaterial, scene]);

  return <primitive object={model} />;
}

useGLTF.preload('/models/graduated-cylinder-50ml.glb');
useGLTF.preload('/models/nessler-tube-50ml.glb');
useGLTF.preload('/models/volumetric-flask-100ml.glb');
useGLTF.preload('/models/graduated-pipette-5ml.glb');
