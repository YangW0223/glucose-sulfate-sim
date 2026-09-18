import { useSimulationStore } from '../store/useSimulationStore';

export function PowderSpills() {
  const spills = useSimulationStore((s) => s.powderSpillRecords);
  return (
    <group>
      {spills.map((spill) => {
        const radius = Math.min(0.025, 0.005 + Math.sqrt(spill.massG) * 0.010);
        const height = Math.min(0.006, 0.0012 + spill.massG * 0.003);
        return (
          <mesh key={spill.id} position={[spill.position[0], spill.position[1] + height / 2, spill.position[2]]} castShadow>
            <cylinderGeometry args={[radius * 0.85, radius, height, 28]} />
            <meshStandardMaterial color="#f3f2ea" roughness={0.96} />
          </mesh>
        );
      })}
    </group>
  );
}
