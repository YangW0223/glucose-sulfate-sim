import { Html } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { LAB_LAYOUT } from './labLayout';
import { LAB_PALETTE } from './labPalette';

const { frame: FRAME, board: SHELF, back: BACK, edge: EDGE } = LAB_PALETTE.shelf;

function ShelfBoard({ y }: { y: number }) {
  return (
    <group>
      <mesh position={[0, y, 0]} receiveShadow castShadow>
        <boxGeometry args={[LAB_LAYOUT.shelf.width, 0.036, LAB_LAYOUT.shelf.depth]} />
        <meshStandardMaterial color={SHELF} roughness={0.76} metalness={0.02} />
      </mesh>
      <mesh position={[0, y + 0.022, LAB_LAYOUT.shelf.depth / 2 - 0.010]} receiveShadow castShadow>
        <boxGeometry args={[LAB_LAYOUT.shelf.width, 0.026, 0.028]} />
        <meshStandardMaterial color={EDGE} roughness={0.7} />
      </mesh>
    </group>
  );
}

function ShelfLabel({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <Html
      position={[x, y + 0.030, LAB_LAYOUT.shelf.depth / 2 + 0.026]}
      center
      occlude={false}
      zIndexRange={[20, 10]}
      style={{ pointerEvents: 'none' }}
    >
      <div className="shelf-instrument-label">{label}</div>
    </Html>
  );
}

export function InstrumentShelf() {
  const centerY = 1.40;
  const frameHeight = 0.82;
  const localLower = LAB_LAYOUT.shelf.lowerShelfTopY - 0.018 - centerY;
  const localUpper = LAB_LAYOUT.shelf.upperShelfTopY - 0.018 - centerY;

  const lowerSlots = [
    { x: -0.70, label: '洗瓶' },
    { x: -0.31, label: '100 ml 容量瓶' },
    { x: 0.10, label: '50 ml 量筒' },
    { x: 0.52, label: '葡萄糖' },
  ];

  const upperSlots = [
    { x: -0.72, label: '供试管' },
    { x: -0.52, label: '对照管' },
    { x: -0.25, label: '5 ml 刻度吸管' },
    { x: 0.04, label: '洗耳球' },
    { x: 0.36, label: '药勺' },
    { x: 0.70, label: '称量纸' },
  ];

  return (
    <RigidBody type="fixed" colliders="cuboid">
      <group position={[0, centerY, LAB_LAYOUT.shelf.centerZ]}>
        <mesh position={[0, 0, -LAB_LAYOUT.shelf.depth / 2 - 0.018]} receiveShadow>
          <boxGeometry args={[LAB_LAYOUT.shelf.width, frameHeight, 0.035]} />
          <meshStandardMaterial color={BACK} roughness={0.86} />
        </mesh>

        <ShelfBoard y={localLower} />
        <ShelfBoard y={localUpper} />

        <mesh position={[0, frameHeight / 2 - 0.02, 0]} receiveShadow castShadow>
          <boxGeometry args={[LAB_LAYOUT.shelf.width + 0.08, 0.052, LAB_LAYOUT.shelf.depth + 0.04]} />
          <meshStandardMaterial color={FRAME} roughness={0.75} />
        </mesh>
        <mesh position={[-LAB_LAYOUT.shelf.width / 2 - 0.025, 0, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.052, frameHeight, LAB_LAYOUT.shelf.depth + 0.04]} />
          <meshStandardMaterial color={FRAME} roughness={0.75} />
        </mesh>
        <mesh position={[LAB_LAYOUT.shelf.width / 2 + 0.025, 0, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.052, frameHeight, LAB_LAYOUT.shelf.depth + 0.04]} />
          <meshStandardMaterial color={FRAME} roughness={0.75} />
        </mesh>

        {lowerSlots.map((slot) => (
          <ShelfLabel key={slot.label} x={slot.x} y={localLower} label={slot.label} />
        ))}
        {upperSlots.map((slot) => (
          <ShelfLabel key={slot.label} x={slot.x} y={localUpper} label={slot.label} />
        ))}
      </group>
    </RigidBody>
  );
}
