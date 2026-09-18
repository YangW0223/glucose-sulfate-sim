import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import { useRef } from 'react';
import * as THREE from 'three';
import { useSimulationStore, WEIGHING_PAPER_MASS_G } from '../store/useSimulationStore';
import { LabSolidModel } from './LabSolidModel';

export const BALANCE_POSITION = new THREE.Vector3(-0.43, 0.85, -0.18);
export const BALANCE_PAN_CENTER = new THREE.Vector3(-0.43, 0.906, -0.186);
export const BALANCE_PAN_RADIUS = 0.048;

export function ElectronicBalance() {
  const paperOnBalance = useSimulationStore((s) => s.paperOnBalance);
  const paperGlucoseMassG = useSimulationStore((s) => s.paperGlucoseMassG);
  const tareG = useSimulationStore((s) => s.balanceTareG);
  const reading = useSimulationStore((s) => s.balanceReadingG);
  const setReading = useSimulationStore((s) => s.setBalanceReading);
  const tareBalance = useSimulationStore((s) => s.tareBalance);
  const displayRef = useRef(0);
  const lastPublishRef = useRef(0);

  const gross = paperOnBalance ? WEIGHING_PAPER_MASS_G + paperGlucoseMassG : 0;

  useFrame((_, delta) => {
    const target = gross - tareG;
    displayRef.current = THREE.MathUtils.damp(displayRef.current, target, 11, delta);
    lastPublishRef.current += delta;
    if (lastPublishRef.current > 0.05) {
      lastPublishRef.current = 0;
      setReading(Math.abs(displayRef.current) < 0.0005 ? 0 : displayRef.current);
    }
  });

  return (
    <RigidBody type="fixed" colliders="cuboid" position={[BALANCE_POSITION.x, BALANCE_POSITION.y, BALANCE_POSITION.z]}>
      <group>
        <LabSolidModel url="/models/electronic-balance.glb" preset="balance" />
        <mesh
          position={[0.064, 0.050, 0.060]}
          onPointerDown={(event) => {
            event.stopPropagation();
            tareBalance(gross);
          }}
        >
          <cylinderGeometry args={[0.012, 0.012, 0.009, 32]} />
          <meshStandardMaterial color="#2e7ca0" roughness={0.34} />
        </mesh>
        <Html position={[0, 0.039, 0.082]} transform distanceFactor={0.72} center occlude={false}>
          <div className="balance-display">{reading.toFixed(3)} g</div>
        </Html>
      </group>
    </RigidBody>
  );
}
