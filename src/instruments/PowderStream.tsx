import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';

export interface PowderStreamState {
  active: boolean;
  start: THREE.Vector3;
  velocity: THREE.Vector3;
  endTime: number;
  intensity: number;
}

interface PowderStreamProps {
  state: MutableRefObject<PowderStreamState>;
}

const PARTICLES = 34;
const gravity = new THREE.Vector3(0, -9.81, 0);

export function PowderStream({ state }: PowderStreamProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const object = useMemo(() => new THREE.Object3D(), []);
  const point = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const s = state.current;
    mesh.visible = s.active;
    if (!s.active) {
      mesh.count = 0;
      return;
    }

    const elapsed = clock.elapsedTime;
    for (let i = 0; i < PARTICLES; i += 1) {
      const phase = (i / PARTICLES + elapsed * (0.9 + s.intensity * 1.4)) % 1;
      const t = phase * s.endTime;
      point.copy(s.start)
        .addScaledVector(s.velocity, t)
        .addScaledVector(gravity, 0.5 * t * t);
      const wobble = (i % 5 - 2) * 0.00045 * (0.35 + phase);
      point.x += wobble;
      point.z += Math.sin(i * 2.399) * 0.00065 * (0.3 + phase);
      object.position.copy(point);
      const scale = THREE.MathUtils.lerp(0.00065, 0.00105, s.intensity) * (0.7 + (i % 4) * 0.08);
      object.scale.setScalar(scale);
      object.rotation.set(i, i * 0.6, i * 0.2);
      object.updateMatrix();
      mesh.setMatrixAt(i, object.matrix);
    }
    mesh.count = PARTICLES;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLES]} frustumCulled={false} renderOrder={5}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#f4f4ef" roughness={0.92} />
    </instancedMesh>
  );
}
