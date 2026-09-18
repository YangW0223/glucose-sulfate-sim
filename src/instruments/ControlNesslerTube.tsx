import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { CylinderCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { InstrumentHitArea } from '../interaction/InstrumentHitArea';
import { smoothDragTarget } from '../interaction/smoothDrag';
import { updateOpeningTarget } from '../engine/spatialRegistry';
import { useSimulationStore } from '../store/useSimulationStore';
import { GlasswareModel } from './GlasswareModel';
import { WorldSpaceLiquid } from './WorldSpaceLiquid';
import { INSTRUMENT_HOME } from '../scene/labLayout';
import {
  NESSLER_50,
  NESSLER_50_CAVITY_CENTER_Y,
  NESSLER_50_CAVITY_HEIGHT,
  NESSLER_50_PHYSICAL_CAPACITY_ML,
} from './glasswareDimensions';

const START_POSITION: [number, number, number] = [...INSTRUMENT_HOME.controlTube];
const DRAG_Y = 1.08;

export function ControlNesslerTube() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const [held, setHeld] = useState(false);
  const [docked, setDocked] = useState(true);
  const heldRef = useRef(false);
  const pointerRef = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y));
  const hitPoint = useRef(new THREE.Vector3());
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const openingWorld = useMemo(() => new THREE.Vector3(), []);
  const openingNormal = useMemo(() => new THREE.Vector3(), []);
  const localOpening = useMemo(() => new THREE.Vector3(0, NESSLER_50.bodyTopY + 0.0025, 0), []);

  const volumeMl = useSimulationStore((s) => s.controlTubeVolumeMl);
  const standardMl = useSimulationStore((s) => s.controlStandardVolumeMl);
  const resetVersion = useSimulationStore((s) => s.resetVersion);
  const setHeldInstrument = useSimulationStore((s) => s.setHeldInstrument);
  const log = useSimulationStore((s) => s.log);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    heldRef.current = false;
    setHeld(false);
    setDocked(true);
    body.setTranslation({ x: START_POSITION[0], y: START_POSITION[1], z: START_POSITION[2] }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, [resetVersion]);

  const updatePointer = (event: ThreeEvent<PointerEvent>) => {
    const rect = gl.domElement.getBoundingClientRect();
    pointerRef.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  };

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) return;
    if (heldRef.current) {
      raycaster.current.setFromCamera(pointerRef.current, camera);
      if (raycaster.current.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
        body.setNextKinematicTranslation(smoothDragTarget(body, {
          x: THREE.MathUtils.clamp(hitPoint.current.x, -0.24, 0.48),
          y: DRAG_Y,
          z: THREE.MathUtils.clamp(hitPoint.current.z, -0.32, 0.30),
        }, delta));
        body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 });
      }
    }

    const t = body.translation();
    const r = body.rotation();
    position.set(t.x, t.y, t.z);
    quaternion.set(r.x, r.y, r.z, r.w);
    openingWorld.copy(localOpening).applyQuaternion(quaternion).add(position);
    openingNormal.set(0, 1, 0).applyQuaternion(quaternion).normalize();
    updateOpeningTarget('controlTube', {
      center: openingWorld,
      normal: openingNormal,
      radius: NESSLER_50.innerRadiusM * 0.92,
      enabled: true,
    });
  });

  const standardRatio = volumeMl > 0.001 ? THREE.MathUtils.clamp(standardMl / volumeMl, 0, 1) : 0;

  return (
    <RigidBody
      ref={bodyRef}
      type={held || docked ? 'kinematicPosition' : 'dynamic'}
      colliders={false}
      position={START_POSITION}
      mass={0.11}
      linearDamping={2.1}
      angularDamping={4.2}
      canSleep={!held}
    >
      <CylinderCollider args={[0.096, 0.0145]} position={[0, 0.008, 0]} />
      <group
        onPointerOver={(event) => {
          event.stopPropagation();
          if (!heldRef.current) gl.domElement.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          if (!heldRef.current) gl.domElement.style.cursor = 'default';
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          setDocked(false);
          updatePointer(event);
          heldRef.current = true;
          setHeld(true);
          setHeldInstrument('controlTube');
          log({ type: 'PICK', payload: { id: 'controlTube' } });
          gl.domElement.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!heldRef.current) return;
          event.stopPropagation();
          updatePointer(event);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          heldRef.current = false;
          setHeld(false);
          setHeldInstrument(null);
          log({ type: 'DROP', payload: { id: 'controlTube' } });
          gl.domElement.releasePointerCapture(event.pointerId);
        }}
      >
        <InstrumentHitArea size={[0.05, 0.22, 0.05]} />
        <GlasswareModel url="/models/nessler-tube-50ml.glb" />
        <WorldSpaceLiquid
          radius={NESSLER_50.innerRadiusM * 0.94}
          cavityHeight={NESSLER_50_CAVITY_HEIGHT}
          centerY={NESSLER_50_CAVITY_CENTER_Y}
          volumeMl={volumeMl}
          physicalCapacityMl={NESSLER_50_PHYSICAL_CAPACITY_ML}
          color={standardRatio > 0.02 ? '#d9ecff' : '#bdeaff'}
        />
        <mesh position={[0, 0.082, NESSLER_50.outerRadiusM + 0.001]}>
          <boxGeometry args={[0.018, 0.012, 0.0008]} />
          <meshStandardMaterial color="#5d8eb6" roughness={0.4} />
        </mesh>
        <mesh position={[0, NESSLER_50.mark25Y, NESSLER_50.outerRadiusM + 0.0007]}>
          <boxGeometry args={[0.017, 0.00075, 0.0007]} />
          <meshStandardMaterial color="#6e8794" roughness={0.42} />
        </mesh>
        <mesh position={[0, NESSLER_50.mark50Y, NESSLER_50.outerRadiusM + 0.0007]}>
          <boxGeometry args={[0.020, 0.0009, 0.0007]} />
          <meshStandardMaterial color="#617d8b" roughness={0.42} />
        </mesh>
      </group>
    </RigidBody>
  );
}
