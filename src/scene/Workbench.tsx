import { RigidBody } from '@react-three/rapier';
import { LAB_PALETTE } from './labPalette';

export function Workbench() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh position={[0, 0.78, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.5, 0.14, 1.35]} />
        <meshStandardMaterial color={LAB_PALETTE.workbench.top} roughness={0.72} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.38, -0.55]} receiveShadow castShadow>
        <boxGeometry args={[2.35, 0.72, 0.08]} />
        <meshStandardMaterial color={LAB_PALETTE.workbench.body} roughness={0.82} />
      </mesh>
    </RigidBody>
  );
}
