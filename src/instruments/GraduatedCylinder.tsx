import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { CylinderCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { InstrumentHitArea } from '../interaction/InstrumentHitArea';
import { smoothDragTarget } from '../interaction/smoothDrag';
import { calculateRimOverflowRateMlPerSec, findBallisticOpeningHit, findBallisticPlaneOpeningHit, transferVolume } from '../engine/liquid';
import { getOpeningTarget, updateOpeningTarget } from '../engine/spatialRegistry';
import { useSimulationStore } from '../store/useSimulationStore';
import { GlasswareModel } from './GlasswareModel';
import { LiquidStream, type LiquidStreamState } from './LiquidStream';
import { WorldSpaceLiquid } from './WorldSpaceLiquid';
import { INSTRUMENT_HOME } from '../scene/labLayout';
import {
  CYLINDER_50,
  CYLINDER_50_CAVITY_CENTER_Y,
  CYLINDER_50_CAVITY_HEIGHT,
  CYLINDER_50_PHYSICAL_CAPACITY_ML,
} from './glasswareDimensions';

const TABLE_TOP_Y = 0.85;
const START_POSITION: [number, number, number] = [...INSTRUMENT_HOME.graduatedCylinder50];
const DRAG_Y = 1.10;

function GraduationMarks() {
  const marks = useMemo(() => Array.from({ length: 51 }, (_, index) => index), []);
  const y0 = CYLINDER_50.cavityBottomY + 0.004;
  const y50 = CYLINDER_50.mark50Y;
  return (
    <group>
      {marks.map((ml) => {
        if (ml === 0) return null;
        const y = y0 + (ml / 50) * (y50 - y0);
        const major = ml % 10 === 0;
        const medium = ml % 5 === 0;
        const width = major ? 0.013 : medium ? 0.010 : 0.0065;
        return (
          <mesh key={ml} position={[0, y, CYLINDER_50.outerRadiusM + 0.00055]}>
            <boxGeometry args={[width, major ? 0.00045 : 0.00028, 0.00045]} />
            <meshStandardMaterial color={major ? '#526f7e' : '#7e98a5'} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

export function GraduatedCylinder() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const [held, setHeld] = useState(false);
  const [docked, setDocked] = useState(true);
  const heldRef = useRef(false);
  const pointerRef = useRef(new THREE.Vector2());
  const tiltRef = useRef(0);
  const surfaceYRef = useRef(-999);
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y));
  const hitPoint = useRef(new THREE.Vector3());
  const streamState = useRef<LiquidStreamState>({
    active: false,
    start: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    endTime: 0.5,
    radius: 0.0018,
  });
  const bodyQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const localLip = useMemo(() => new THREE.Vector3(), []);
  const mouthWorld = useMemo(() => new THREE.Vector3(), []);
  const openingWorld = useMemo(() => new THREE.Vector3(), []);
  const localOpeningCenter = useMemo(() => new THREE.Vector3(0, CYLINDER_50.bodyTopY + 0.002, 0), []);
  const exitDirection = useMemo(() => new THREE.Vector3(), []);
  const openingNormal = useMemo(() => new THREE.Vector3(), []);
  const bodyPosition = useMemo(() => new THREE.Vector3(), []);

  const sourceVolumeMl = useSimulationStore((s) => s.sourceVolumeMl);
  const targetVolumeMl = useSimulationStore((s) => s.targetVolumeMl);
  const controlTubeVolumeMl = useSimulationStore((s) => s.controlTubeVolumeMl);
  const setSourceVolume = useSimulationStore((s) => s.setSourceVolume);
  const setTargetVolume = useSimulationStore((s) => s.setTargetVolume);
  const setControlTubeVolume = useSimulationStore((s) => s.setControlTubeVolume);
  const recordSpill = useSimulationStore((s) => s.recordSpill);
  const setTelemetry = useSimulationStore((s) => s.setTelemetry);
  const resetVersion = useSimulationStore((s) => s.resetVersion);
  const setHeldInstrument = useSimulationStore((s) => s.setHeldInstrument);
  const log = useSimulationStore((s) => s.log);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    heldRef.current = false;
    tiltRef.current = 0;
    setHeld(false);
    setDocked(true);
    setHeldInstrument(null);
    body.setTranslation({ x: START_POSITION[0], y: START_POSITION[1], z: START_POSITION[2] }, true);
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

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) return;

    if (heldRef.current) {
      raycaster.current.setFromCamera(pointerRef.current, camera);
      if (raycaster.current.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
        body.setNextKinematicTranslation(smoothDragTarget(body, {
          x: THREE.MathUtils.clamp(hitPoint.current.x, -0.45, 0.44),
          y: DRAG_Y,
          z: THREE.MathUtils.clamp(hitPoint.current.z, -0.34, 0.34),
        }, delta));
        bodyQuaternion.setFromEuler(new THREE.Euler(0, 0, tiltRef.current));
        body.setNextKinematicRotation(bodyQuaternion);
      }
    }

    const translation = body.translation();
    const rotation = body.rotation();
    bodyQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    bodyPosition.set(translation.x, translation.y, translation.z);
    openingWorld.copy(localOpeningCenter).applyQuaternion(bodyQuaternion).add(bodyPosition);
    openingNormal.set(0, 1, 0).applyQuaternion(bodyQuaternion).normalize();
    updateOpeningTarget('cylinder50', {
      center: openingWorld,
      radius: CYLINDER_50.innerRadiusM * 0.9,
      normal: openingNormal,
      enabled: true,
    });

    const tilt = tiltRef.current;
    const side = tilt >= 0 ? -1 : 1;
    localLip.set(side * CYLINDER_50.innerRadiusM, CYLINDER_50.bodyTopY, 0);
    mouthWorld.copy(localLip).applyQuaternion(bodyQuaternion).add(bodyPosition);

    exitDirection.set(side, -0.06, 0).applyQuaternion(bodyQuaternion).normalize();
    const headMeters = Math.max(0, surfaceYRef.current - mouthWorld.y);
    const rate = heldRef.current && sourceVolumeMl > 0
      ? calculateRimOverflowRateMlPerSec({
          headMeters,
          tiltRad: Math.abs(tilt),
          outletWidthMeters: 0.007,
        })
      : 0;

    if (rate > 0.02 && sourceVolumeMl > 0) {
      const initialSpeed = THREE.MathUtils.clamp(0.30 + rate * 0.0105, 0.31, 0.88);
      const velocity = exitDirection.clone().multiplyScalar(initialSpeed);
      const tubeOpening = getOpeningTarget('testTube');
      const tubeHit = tubeOpening?.enabled
        ? findBallisticPlaneOpeningHit(mouthWorld, velocity, tubeOpening)
        : null;
      const controlOpening = getOpeningTarget('controlTube');
      const controlHit = controlOpening?.enabled
        ? findBallisticPlaneOpeningHit(mouthWorld, velocity, controlOpening)
        : null;
      const targetHits: Array<{ kind: 'tube' | 'control-tube'; hit: { hit: boolean; point: THREE.Vector3; time: number } }> = [];
      if (tubeHit?.hit) targetHits.push({ kind: 'tube', hit: tubeHit });
      if (controlHit?.hit) targetHits.push({ kind: 'control-tube', hit: controlHit });
      targetHits.sort((a, b) => a.hit.time - b.hit.time);
      const firstTarget = targetHits[0];

      const benchY = TABLE_TOP_Y + 0.006;
      const benchHit = findBallisticOpeningHit(
        mouthWorld,
        velocity,
        { center: new THREE.Vector3(0, benchY, 0), radius: 10, y: benchY },
      );

      const endTime = firstTarget?.hit.time ?? benchHit?.time ?? 0.62;
      streamState.current.active = true;
      streamState.current.start.copy(mouthWorld);
      streamState.current.velocity.copy(velocity);
      streamState.current.endTime = THREE.MathUtils.clamp(endTime, 0.05, 0.82);

      const requested = rate * delta;
      const { transferredMl } = transferVolume(sourceVolumeMl, requested);
      setSourceVolume(sourceVolumeMl - transferredMl);

      if (firstTarget?.kind === 'tube' && targetVolumeMl < 50) {
        const accepted = Math.min(transferredMl, 50 - targetVolumeMl);
        setTargetVolume(targetVolumeMl + accepted);
        if (accepted < transferredMl) {
          recordSpill({
            volumeMl: transferredMl - accepted,
            position: [firstTarget.hit.point.x, TABLE_TOP_Y + 0.008, firstTarget.hit.point.z],
          });
        }
        setTelemetry({
          rate,
          tiltDeg: THREE.MathUtils.radToDeg(Math.abs(tilt)),
          destination: 'tube',
          operation: 'cylinder-to-tube',
        });
      } else if (firstTarget?.kind === 'control-tube' && controlTubeVolumeMl < 50) {
        const accepted = Math.min(transferredMl, 50 - controlTubeVolumeMl);
        setControlTubeVolume(controlTubeVolumeMl + accepted);
        if (accepted < transferredMl) {
          recordSpill({
            volumeMl: transferredMl - accepted,
            position: [firstTarget.hit.point.x, TABLE_TOP_Y + 0.008, firstTarget.hit.point.z],
          });
        }
        setTelemetry({
          rate,
          tiltDeg: THREE.MathUtils.radToDeg(Math.abs(tilt)),
          destination: 'control-tube',
          operation: 'cylinder-to-control',
        });
      } else {
        const point = benchHit?.point ?? mouthWorld;
        recordSpill({ volumeMl: transferredMl, position: [point.x, TABLE_TOP_Y + 0.008, point.z] });
        setTelemetry({
          rate,
          tiltDeg: THREE.MathUtils.radToDeg(Math.abs(tilt)),
          destination: 'bench',
          operation: 'cylinder-to-tube',
        });
      }
    } else {
      streamState.current.active = false;
      setTelemetry({
        rate: 0,
        tiltDeg: THREE.MathUtils.radToDeg(Math.abs(tilt)),
        destination: 'none',
        operation: heldRef.current ? 'cylinder-to-tube' : 'none',
      });
    }
  });

  const rotate = (dir: 1 | -1) => {
    tiltRef.current = THREE.MathUtils.clamp(
      tiltRef.current + dir * THREE.MathUtils.degToRad(5),
      THREE.MathUtils.degToRad(-88),
      THREE.MathUtils.degToRad(88),
    );
  };

  return (
    <>
      <RigidBody
        ref={bodyRef}
        type={held || docked ? 'kinematicPosition' : 'dynamic'}
        colliders={false}
        position={START_POSITION}
        mass={0.19}
        linearDamping={1.8}
        angularDamping={2.4}
        canSleep={!held}
      >
        <CylinderCollider args={[0.082, 0.030]} position={[0, 0.003, 0]} />
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
            setHeldInstrument('cylinder50');
            log({ type: 'PICK', payload: { id: 'cylinder50' } });
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
            streamState.current.active = false;
            log({ type: 'DROP', payload: { id: 'cylinder50' } });
            gl.domElement.releasePointerCapture(event.pointerId);
          }}
          onWheel={(event) => {
            if (!heldRef.current) return;
            event.stopPropagation();
            rotate(event.deltaY > 0 ? 1 : -1);
          }}
        >
          <InstrumentHitArea size={[0.065, 0.19, 0.065]} />
        <GlasswareModel url="/models/graduated-cylinder-50ml.glb" />
          <GraduationMarks />
          <WorldSpaceLiquid
            radius={CYLINDER_50.innerRadiusM * 0.96}
            cavityHeight={CYLINDER_50_CAVITY_HEIGHT}
            centerY={CYLINDER_50_CAVITY_CENTER_Y}
            volumeMl={sourceVolumeMl}
            physicalCapacityMl={CYLINDER_50_PHYSICAL_CAPACITY_ML}
            onSurfaceY={(value) => {
              surfaceYRef.current = value;
            }}
          />
        </group>
      </RigidBody>
      <LiquidStream state={streamState} />
    </>
  );
}
