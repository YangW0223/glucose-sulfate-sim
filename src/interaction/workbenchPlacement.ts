import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';
import type { InstrumentId } from '../types/simulation';
import { INSTRUMENT_HOME, LAB_LAYOUT } from '../scene/labLayout';

export const WORKBENCH_DROP_BOUNDS = {
  minX: -0.82,
  maxX: 0.82,
  minZ: -0.44,
  maxZ: 0.43,
} as const;

const shelfTopFor = (id: InstrumentId) => {
  switch (id) {
    case 'washBottle':
    case 'volumetricFlask':
    case 'cylinder50':
    case 'glucoseBottle':
      return LAB_LAYOUT.shelf.lowerShelfTopY;
    default:
      return LAB_LAYOUT.shelf.upperShelfTopY;
  }
};

const homeFor = (id: InstrumentId): readonly [number, number, number] => {
  switch (id) {
    case 'washBottle': return INSTRUMENT_HOME.washBottle;
    case 'volumetricFlask': return INSTRUMENT_HOME.volumetricFlask;
    case 'cylinder50': return INSTRUMENT_HOME.graduatedCylinder50;
    case 'glucoseBottle': return INSTRUMENT_HOME.glucoseBottle;
    case 'testTube': return INSTRUMENT_HOME.testTube;
    case 'controlTube': return INSTRUMENT_HOME.controlTube;
    case 'pipette5': return INSTRUMENT_HOME.graduatedPipette5;
    case 'pipetteBulb': return INSTRUMENT_HOME.pipetteBulb;
    case 'spatula': return INSTRUMENT_HOME.spatula;
    case 'weighingPaper': return INSTRUMENT_HOME.weighingPaper;
  }
};

export function isOverWorkbench(x: number, z: number) {
  return x >= WORKBENCH_DROP_BOUNDS.minX && x <= WORKBENCH_DROP_BOUNDS.maxX
    && z >= WORKBENCH_DROP_BOUNDS.minZ && z <= WORKBENCH_DROP_BOUNDS.maxZ;
}

export function clampToWorkbench(x: number, z: number) {
  return {
    x: THREE.MathUtils.clamp(x, WORKBENCH_DROP_BOUNDS.minX, WORKBENCH_DROP_BOUNDS.maxX),
    z: THREE.MathUtils.clamp(z, WORKBENCH_DROP_BOUNDS.minZ, WORKBENCH_DROP_BOUNDS.maxZ),
  };
}

export function getWorkbenchOriginY(id: InstrumentId) {
  const home = homeFor(id);
  return LAB_LAYOUT.tableTopY + (home[1] - shelfTopFor(id)) + 0.002;
}

export function snapRigidBodyToWorkbench(body: RapierRigidBody, id: InstrumentId, keepRotation = false) {
  const t = body.translation();
  if (!isOverWorkbench(t.x, t.z)) return false;
  const p = clampToWorkbench(t.x, t.z);
  body.setTranslation({ x: p.x, y: getWorkbenchOriginY(id), z: p.z }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  if (!keepRotation) body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  return true;
}

export const INSTRUMENT_LABEL: Record<InstrumentId, string> = {
  washBottle: '洗瓶',
  cylinder50: '50 ml 量筒',
  testTube: '供试管',
  controlTube: '对照管',
  spatula: '药勺',
  weighingPaper: '称量纸',
  volumetricFlask: '100 ml 容量瓶',
  pipette5: '5 ml 刻度吸管',
  pipetteBulb: '洗耳球',
  glucoseBottle: '葡萄糖试剂瓶',
};
