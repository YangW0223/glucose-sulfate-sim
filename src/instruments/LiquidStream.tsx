import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';

export interface LiquidStreamState {
  active: boolean;
  start: THREE.Vector3;
  velocity: THREE.Vector3;
  endTime: number;
  radius: number;
}

interface LiquidStreamProps {
  state: MutableRefObject<LiquidStreamState>;
}

const MAX_SEGMENTS = 42;
const gravity = new THREE.Vector3(0, -9.81, 0);
const yAxis = new THREE.Vector3(0, 1, 0);

export function LiquidStream({ state }: LiquidStreamProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const impactRef = useRef<THREE.Mesh>(null);
  const object = useMemo(() => new THREE.Object3D(), []);
  const p0 = useMemo(() => new THREE.Vector3(), []);
  const p1 = useMemo(() => new THREE.Vector3(), []);
  const vNow = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const midpoint = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    const impact = impactRef.current;
    if (!mesh || !impact) return;
    const s = state.current;
    mesh.visible = s.active;
    impact.visible = s.active;
    if (!s.active) {
      mesh.count = 0;
      return;
    }

    const initialSpeed = Math.max(0.05, s.velocity.length());
    for (let i = 0; i < MAX_SEGMENTS; i += 1) {
      const t0 = (i / MAX_SEGMENTS) * s.endTime;
      const t1 = ((i + 1) / MAX_SEGMENTS) * s.endTime;
      p0.copy(s.start).addScaledVector(s.velocity, t0).addScaledVector(gravity, 0.5 * t0 * t0);
      p1.copy(s.start).addScaledVector(s.velocity, t1).addScaledVector(gravity, 0.5 * t1 * t1);
      direction.copy(p1).sub(p0);
      const length = direction.length();
      midpoint.copy(p0).add(p1).multiplyScalar(0.5);

      const tm = (t0 + t1) * 0.5;
      vNow.copy(s.velocity).addScaledVector(gravity, tm);
      // Approximate jet thinning from continuity as falling water accelerates.
      const radius = s.radius * Math.sqrt(initialSpeed / Math.max(initialSpeed, vNow.length()));

      object.position.copy(midpoint);
      object.quaternion.setFromUnitVectors(yAxis, direction.normalize());
      object.scale.set(Math.max(0.0003, radius), Math.max(0.00001, length), Math.max(0.0003, radius));
      object.updateMatrix();
      mesh.setMatrixAt(i, object.matrix);
    }
    mesh.count = MAX_SEGMENTS;
    mesh.instanceMatrix.needsUpdate = true;

    const t = s.endTime;
    impact.position.copy(s.start).addScaledVector(s.velocity, t).addScaledVector(gravity, 0.5 * t * t);
    const impactScale = Math.max(0.0017, s.radius * 1.9);
    impact.scale.setScalar(impactScale);
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_SEGMENTS]} frustumCulled={false} renderOrder={4}>
        <cylinderGeometry args={[1, 0.78, 1, 10, 1, false]} />
        <meshPhysicalMaterial
          color="#bceaff"
          transmission={0.9}
          transparent
          opacity={0.7}
          roughness={0.045}
          ior={1.333}
          thickness={0.003}
          depthWrite={false}
        />
      </instancedMesh>
      <mesh ref={impactRef} renderOrder={5}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshPhysicalMaterial
          color="#c7edff"
          transmission={0.88}
          transparent
          opacity={0.55}
          roughness={0.06}
          ior={1.333}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
