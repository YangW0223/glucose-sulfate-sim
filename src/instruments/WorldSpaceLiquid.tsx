import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { calculateCylinderSurfaceWorldY } from '../engine/liquidSurface';

interface WorldSpaceLiquidProps {
  radius: number;
  cavityHeight: number;
  centerY: number;
  volumeMl: number;
  physicalCapacityMl: number;
  color?: string;
  turbidity?: number;
  onSurfaceY?: (value: number) => void;
}

interface ShaderWithUniforms {
  uniforms: Record<string, { value: unknown }>;
}

const SURFACE_UPDATE_INTERVAL = 1 / 30;

export function WorldSpaceLiquid({
  radius,
  cavityHeight,
  centerY,
  volumeMl,
  physicalCapacityMl,
  color = '#bdeaff',
  turbidity = 0,
  onSurfaceY,
}: WorldSpaceLiquidProps) {
  const volumeRef = useRef<THREE.Mesh>(null);
  const surfaceRef = useRef<THREE.Mesh>(null);
  const liquidShaderRef = useRef<ShaderWithUniforms | null>(null);
  const surfaceShaderRef = useRef<ShaderWithUniforms | null>(null);
  const updateAccumulatorRef = useRef(SURFACE_UPDATE_INTERVAL);
  const parentInverse = useMemo(() => new THREE.Matrix4(), []);
  const parentQuat = useMemo(() => new THREE.Quaternion(), []);
  const inverseParentQuat = useMemo(() => new THREE.Quaternion(), []);
  const worldCenter = useMemo(() => new THREE.Vector3(), []);
  const horizontalWorldQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
    [],
  );
  const localSurfacePosition = useMemo(() => new THREE.Vector3(), []);
  const worldScale = useMemo(() => new THREE.Vector3(), []);

  const bodyMaterial = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      transmission: THREE.MathUtils.clamp(0.92 - turbidity * 0.72, 0.12, 0.92),
      transparent: true,
      opacity: THREE.MathUtils.clamp(0.44 + turbidity * 0.42, 0.44, 0.9),
      roughness: 0.08 + turbidity * 0.36,
      ior: 1.333,
      thickness: 0.018,
      attenuationColor: new THREE.Color(color),
      attenuationDistance: Math.max(0.08, 0.6 - turbidity * 0.45),
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSurfaceWorldY = { value: -999 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vLiquidWorldPosition;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvLiquidWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uSurfaceWorldY;\nvarying vec3 vLiquidWorldPosition;',
        )
        .replace(
          '#include <clipping_planes_fragment>',
          '#include <clipping_planes_fragment>\nif (vLiquidWorldPosition.y > uSurfaceWorldY) discard;',
        );
      liquidShaderRef.current = shader as unknown as ShaderWithUniforms;
    };
    material.customProgramCacheKey = () => 'world-space-liquid-body-v3';
    return material;
  }, [color, turbidity]);

  const surfaceMaterial = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.28),
      transmission: 0.78,
      transparent: true,
      opacity: 0.62,
      roughness: 0.035,
      ior: 1.333,
      thickness: 0.002,
      clearcoat: 0.38,
      clearcoatRoughness: 0.03,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWorldToContainer = { value: new THREE.Matrix4() };
      shader.uniforms.uRadius = { value: radius };
      shader.uniforms.uHalfHeight = { value: cavityHeight / 2 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSurfaceWorldPosition;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvSurfaceWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform mat4 uWorldToContainer;\nuniform float uRadius;\nuniform float uHalfHeight;\nvarying vec3 vSurfaceWorldPosition;',
        )
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          vec3 liquidLocal = (uWorldToContainer * vec4(vSurfaceWorldPosition, 1.0)).xyz;
          float liquidRadius = length(liquidLocal.xz);
          if (liquidRadius > uRadius || abs(liquidLocal.y) > uHalfHeight + 0.002) discard;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float meniscusEdge = smoothstep(uRadius * 0.74, uRadius, liquidRadius);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.96, 1.0), meniscusEdge * 0.46);
          diffuseColor.a *= 0.76 + meniscusEdge * 0.24;`,
        );
      surfaceShaderRef.current = shader as unknown as ShaderWithUniforms;
    };
    material.customProgramCacheKey = () => 'world-space-liquid-surface-v3';
    return material;
  }, [cavityHeight, color, radius]);

  useFrame((_, delta) => {
    updateAccumulatorRef.current += Math.min(delta, 0.05);
    if (updateAccumulatorRef.current < SURFACE_UPDATE_INTERVAL) return;
    updateAccumulatorRef.current = 0;

    const volumeMesh = volumeRef.current;
    const surfaceMesh = surfaceRef.current;
    if (!volumeMesh || !surfaceMesh) return;

    volumeMesh.updateWorldMatrix(true, false);
    const fillRatio = THREE.MathUtils.clamp(volumeMl / physicalCapacityMl, 0, 1);
    const surfaceWorldY = calculateCylinderSurfaceWorldY(
      volumeMesh.matrixWorld,
      radius,
      cavityHeight,
      fillRatio,
    );

    if (liquidShaderRef.current) {
      liquidShaderRef.current.uniforms.uSurfaceWorldY.value = surfaceWorldY;
    }
    onSurfaceY?.(surfaceWorldY);

    const parent = volumeMesh.parent;
    if (!parent) return;
    parent.updateWorldMatrix(true, false);
    parent.matrixWorld.decompose(worldCenter, parentQuat, worldScale);
    worldCenter.y = surfaceWorldY;
    parentInverse.copy(parent.matrixWorld).invert();
    localSurfacePosition.copy(worldCenter).applyMatrix4(parentInverse);
    surfaceMesh.position.copy(localSurfacePosition);

    inverseParentQuat.copy(parentQuat).invert();
    surfaceMesh.quaternion.copy(inverseParentQuat).multiply(horizontalWorldQuat);
    surfaceMesh.updateMatrixWorld(true);

    if (surfaceShaderRef.current) {
      (surfaceShaderRef.current.uniforms.uWorldToContainer.value as THREE.Matrix4)
        .copy(volumeMesh.matrixWorld)
        .invert();
    }
    surfaceMesh.visible = volumeMl > 0.01;
  });

  return (
    <>
      <mesh ref={volumeRef} position={[0, centerY, 0]} material={bodyMaterial} renderOrder={2}>
        <cylinderGeometry args={[radius, radius, cavityHeight, 64, 1, false]} />
      </mesh>
      <mesh ref={surfaceRef} material={surfaceMaterial} renderOrder={3}>
        <planeGeometry args={[radius * 40, radius * 40, 1, 1]} />
      </mesh>
    </>
  );
}
