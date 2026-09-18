import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { createGlassMaterial } from './GlassMaterial';

interface GlasswareModelProps {
  url: string;
}

/**
 * 玻璃器皿统一渲染：
 * 1. PBR transmission 保留玻璃透光；
 * 2. 使用稳定深度写入，减少透明物体与层板/液体之间的排序闪烁；
 * 3. 仅给结构硬边添加深色轮廓，并关闭轮廓自身的 depthTest，避免轮廓与玻璃表面 z-fighting。
 */
export function GlasswareModel({ url }: GlasswareModelProps) {
  const { scene } = useGLTF(url);
  const glassMaterial = useMemo(() => createGlassMaterial(), []);
  const edgeMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#173f4d',
        transparent: true,
        opacity: 0.82,
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
      // 透明玻璃本身不参与阴影贴图，避免器皿底部出现高频阴影噪点/闪烁。
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 4;

      // EdgesGeometry 的阈值较高，只突出杯口、底座、连接边等结构，不画满整圈竖线。
      const edges = new THREE.EdgesGeometry(mesh.geometry, 38);
      const lines = new THREE.LineSegments(edges, edgeMaterial);
      lines.renderOrder = 20;
      lines.frustumCulled = false;
      lines.raycast = () => null;
      lines.name = `${mesh.name || 'GlassMesh'}__outline`;
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
