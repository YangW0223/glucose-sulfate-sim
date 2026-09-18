import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { CylinderCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
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

interface NesslerTubeProps {
  volumeMl: number;
}

export const NESSLER_POSITION = {
  x: INSTRUMENT_HOME.testTube[0],
  y: INSTRUMENT_HOME.testTube[1],
  z: INSTRUMENT_HOME.testTube[2],
} as const;
export const NESSLER_OPENING_RADIUS = NESSLER_50.innerRadiusM * 0.92;
const DRAG_Y = 1.08;

export function NesslerTube({ volumeMl }: NesslerTubeProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const [held, setHeld] = useState(false);
  const [docked, setDocked] = useState(true);
  const heldRef = useRef(false);
  const pointerRef = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y));
  const hitPoint = useRef(new THREE.Vector3());
  const bodyQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const bodyPosition = useMemo(() => new THREE.Vector3(), []);
  const openingWorld = useMemo(() => new THREE.Vector3(), []);
  const openingNormal = useMemo(() => new THREE.Vector3(), []);
  const localOpeningCenter = useMemo(() => new THREE.Vector3(0, NESSLER_50.bodyTopY + 0.0025, 0), []);

  const resetVersion = useSimulationStore((s) => s.resetVersion);
  const tubeGlucoseMassG = useSimulationStore((s) => s.tubeGlucoseMassG);
  const setHeldInstrument = useSimulationStore((s) => s.setHeldInstrument);
  const log = useSimulationStore((s) => s.log);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    heldRef.current = false;
    setHeld(false);
    setDocked(true);
    setHeldInstrument(null);
    body.setTranslation({ x: NESSLER_POSITION.x, y: NESSLER_POSITION.y, z: NESSLER_POSITION.z }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, [resetVersion, setHeldInstrument]);

  const updatePointer = (event: ThreeEvent<PointerEvent>) => {
    const rect = gl.domElement.getBoundingClientRect();
    pointerRef.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  };

  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (heldRef.current) {
      raycaster.current.setFromCamera(pointerRef.current, camera);
      if (raycaster.current.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
        body.setNextKinematicTranslation({
          x: THREE.MathUtils.clamp(hitPoint.current.x, -0.30, 0.48),
          y: DRAG_Y,
          z: THREE.MathUtils.clamp(hitPoint.current.z, -0.32, 0.32),
        });
        body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 });
      }
    }

    const translation = body.translation();
    const rotation = body.rotation();
    bodyPosition.set(translation.x, translation.y, translation.z);
    bodyQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    openingWorld.copy(localOpeningCenter).applyQuaternion(bodyQuaternion).add(bodyPosition);
    openingNormal.set(0, 1, 0).applyQuaternion(bodyQuaternion).normalize();
    updateOpeningTarget('testTube', {
      center: openingWorld,
      normal: openingNormal,
      radius: NESSLER_OPENING_RADIUS,
      enabled: true,
    });
  });

  return (
    <RigidBody
      ref={bodyRef}
      type={held || docked ? 'kinematicPosition' : 'dynamic'}
      colliders={false}
      position={[NESSLER_POSITION.x, NESSLER_POSITION.y, NESSLER_POSITION.z]}
      mass={0.11}
      linearDamping={2.1}
      angularDamping={4.2}
      canSleep={!held}
    >
      <CylinderCollider args={[0.096, 0.0145]} position={[0, 0.008, 0]} />
      <group
        onPointerDown={(event) => {
          event.stopPropagation();
          setDocked(false);
          updatePointer(event);
          heldRef.current = true;
          setHeld(true);
          setHeldInstrument('testTube');
          log({ type: 'PICK', payload: { id: 'testTube' } });
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
          log({ type: 'DROP', payload: { id: 'testTube' } });
          gl.domElement.releasePointerCapture(event.pointerId);
        }}
      >
        <GlasswareModel url="/models/nessler-tube-50ml.glb" />
        {tubeGlucoseMassG > 0.001 && volumeMl < 4 && (
          <mesh position={[0, NESSLER_50.cavityBottomY + 0.006, 0]} scale={[1, 0.65, 1]} castShadow>
            <sphereGeometry args={[0.0085 * Math.sqrt(Math.min(1.25, tubeGlucoseMassG / 2)), 26, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#f4f3eb" roughness={0.97} />
          </mesh>
        )}
        <WorldSpaceLiquid
          radius={NESSLER_50.innerRadiusM * 0.94}
          cavityHeight={NESSLER_50_CAVITY_HEIGHT}
          centerY={NESSLER_50_CAVITY_CENTER_Y}
          volumeMl={volumeMl}
          physicalCapacityMl={NESSLER_50_PHYSICAL_CAPACITY_ML}
        />

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
