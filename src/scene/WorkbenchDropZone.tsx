import { Html } from '@react-three/drei';
import { useSimulationStore } from '../store/useSimulationStore';
import { INSTRUMENT_LABEL, WORKBENCH_DROP_BOUNDS } from '../interaction/workbenchPlacement';
import { LAB_LAYOUT } from './labLayout';

export function WorkbenchDropZone() {
  const held = useSimulationStore((s) => s.heldInstrumentId);
  if (!held) return null;

  const width = WORKBENCH_DROP_BOUNDS.maxX - WORKBENCH_DROP_BOUNDS.minX;
  const depth = WORKBENCH_DROP_BOUNDS.maxZ - WORKBENCH_DROP_BOUNDS.minZ;
  const cx = (WORKBENCH_DROP_BOUNDS.minX + WORKBENCH_DROP_BOUNDS.maxX) / 2;
  const cz = (WORKBENCH_DROP_BOUNDS.minZ + WORKBENCH_DROP_BOUNDS.maxZ) / 2;
  const y = LAB_LAYOUT.tableTopY + 0.010;
  const edge = '#f3c85e';

  return (
    <group>
      <mesh position={[cx, y, WORKBENCH_DROP_BOUNDS.minZ]}>
        <boxGeometry args={[width, 0.003, 0.008]} />
        <meshBasicMaterial color={edge} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[cx, y, WORKBENCH_DROP_BOUNDS.maxZ]}>
        <boxGeometry args={[width, 0.003, 0.008]} />
        <meshBasicMaterial color={edge} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[WORKBENCH_DROP_BOUNDS.minX, y, cz]}>
        <boxGeometry args={[0.008, 0.003, depth]} />
        <meshBasicMaterial color={edge} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[WORKBENCH_DROP_BOUNDS.maxX, y, cz]}>
        <boxGeometry args={[0.008, 0.003, depth]} />
        <meshBasicMaterial color={edge} depthWrite={false} toneMapped={false} />
      </mesh>
      <Html position={[0, y + 0.035, 0.37]} center occlude={false} style={{ pointerEvents: 'none' }}>
        <div className="drop-zone-tip">正在拿取：{INSTRUMENT_LABEL[held]} · 移到框内松开鼠标放到实验台</div>
      </Html>
    </group>
  );
}
