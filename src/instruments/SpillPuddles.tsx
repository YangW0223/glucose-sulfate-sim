import { useMemo } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '../store/useSimulationStore';

export function SpillPuddles() {
  const records = useSimulationStore((s) => s.spillRecords);
  const puddles = useMemo(() => {
    return records.map((spill, index) => {
      const radius = THREE.MathUtils.clamp(0.012 + Math.sqrt(spill.volumeMl) * 0.007, 0.012, 0.075);
      return { ...spill, radius, index };
    });
  }, [records]);

  return (
    <group>
      {puddles.map((spill) => (
        <mesh
          key={spill.id}
          position={[spill.position[0], spill.position[1] + spill.index * 0.00001, spill.position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={1}
        >
          <circleGeometry args={[spill.radius, 40]} />
          <meshPhysicalMaterial
            color={spill.liquid === 'standardSulfate' ? '#d4e9ff' : '#bceaff'}
            transmission={0.9}
            transparent
            opacity={spill.liquid === 'standardSulfate' ? 0.40 : 0.34}
            roughness={0.12}
            ior={1.333}
            thickness={0.001}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
