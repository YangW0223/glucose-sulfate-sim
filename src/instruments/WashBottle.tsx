import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { CylinderCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { calculateSqueezeJetRateMlPerSec, findBallisticOpeningHit, findBallisticPlaneOpeningHit, transferVolume } from '../engine/liquid';
import { getOpeningTarget } from '../engine/spatialRegistry';
import { useSimulationStore } from '../store/useSimulationStore';
import { LiquidStream, type LiquidStreamState } from './LiquidStream';
import { PlasticwareModel } from './PlasticwareModel';
import { INSTRUMENT_HOME } from '../scene/labLayout';

const TABLE_TOP_Y = 0.85;
const START_POSITION: [number, number, number] = [...INSTRUMENT_HOME.washBottle];
const DRAG_Y = 1.02;
const LOCAL_NOZZLE_TIP = new THREE.Vector3(0.108, 0.142, 0);
const LOCAL_NOZZLE_DIRECTION = new THREE.Vector3(0.071, -0.040, 0).normalize();

export function WashBottle() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const [held, setHeld] = useState(false);
  const [docked, setDocked] = useState(true);
  const heldRef = useRef(false);
  const squeezeRef = useRef(false);
  const pressureRef = useRef(0);
  const pointerRef = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y));
  const hitPoint = useRef(new THREE.Vector3());
  const bodyQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const bottleWorldPosition = useMemo(() => new THREE.Vector3(), []);
  const nozzleWorld = useMemo(() => new THREE.Vector3(), []);
  const nozzleDirection = useMemo(() => new THREE.Vector3(), []);
  const benchCenter = useMemo(() => new THREE.Vector3(0, TABLE_TOP_Y + 0.006, 0), []);
  const streamState = useRef<LiquidStreamState>({
    active: false,
    start: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    endTime: 0.5,
    radius: 0.0012,
  });
  const lastLogAt = useRef(0);

  const bottleVolume = useSimulationStore((s) => s.washBottleVolumeMl);
  const cylinderVolume = useSimulationStore((s) => s.sourceVolumeMl);
  const resetVersion = useSimulationStore((s) => s.resetVersion);
  const setBottleVolume = useSimulationStore((s) => s.setWashBottleVolume);
  const setCylinderVolume = useSimulationStore((s) => s.setSourceVolume);
  const recordSpill = useSimulationStore((s) => s.recordSpill);
  const setTelemetry = useSimulationStore((s) => s.setTelemetry);
  const setHeldInstrument = useSimulationStore((s) => s.setHeldInstrument);
  const log = useSimulationStore((s) => s.log);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!heldRef.current || event.code !== 'Space') return;
      event.preventDefault();
      if (!squeezeRef.current) log({ type: 'SQUEEZE_START', payload: { id: 'washBottle' } });
      squeezeRef.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      if (squeezeRef.current) log({ type: 'SQUEEZE_END', payload: { id: 'washBottle' } });
      squeezeRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [log]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    heldRef.current = false;
    squeezeRef.current = false;
    pressureRef.current = 0;
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
        body.setNextKinematicTranslation({
          x: THREE.MathUtils.clamp(hitPoint.current.x, -0.55, 0.30),
          y: DRAG_Y,
          z: THREE.MathUtils.clamp(hitPoint.current.z, -0.34, 0.34),
        });
        body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 });
      }
    }

    const pressureTarget = squeezeRef.current && heldRef.current ? 1 : 0;
    pressureRef.current = THREE.MathUtils.damp(pressureRef.current, pressureTarget, pressureTarget > 0 ? 12 : 8, delta);

    const translation = body.translation();
    const rotation = body.rotation();
    bodyQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    bottleWorldPosition.set(translation.x, translation.y, translation.z);
    nozzleWorld.copy(LOCAL_NOZZLE_TIP).applyQuaternion(bodyQuaternion).add(bottleWorldPosition);
    nozzleDirection.copy(LOCAL_NOZZLE_DIRECTION).applyQuaternion(bodyQuaternion).normalize();

    const rate = heldRef.current
      ? calculateSqueezeJetRateMlPerSec({ pressure01: pressureRef.current, remainingVolumeMl: bottleVolume })
      : 0;

    if (rate > 0.02 && bottleVolume > 0) {
      const speed = THREE.MathUtils.lerp(0.62, 1.35, pressureRef.current);
      const velocity = nozzleDirection.clone().multiplyScalar(speed);
      const cylinderOpening = getOpeningTarget('cylinder50');
      const cylinderHit = cylinderOpening?.enabled
        ? findBallisticPlaneOpeningHit(nozzleWorld, velocity, cylinderOpening)
        : null;
      const benchHit = findBallisticOpeningHit(nozzleWorld, velocity, {
        center: benchCenter,
        radius: 10,
        y: benchCenter.y,
      });

      const endTime = cylinderHit?.hit ? cylinderHit.time : benchHit?.time ?? 0.7;
      streamState.current.active = true;
      streamState.current.start.copy(nozzleWorld);
      streamState.current.velocity.copy(velocity);
      streamState.current.endTime = THREE.MathUtils.clamp(endTime, 0.04, 0.8);
      streamState.current.radius = THREE.MathUtils.lerp(0.00075, 0.00165, pressureRef.current);

      const { transferredMl } = transferVolume(bottleVolume, rate * delta);
      setBottleVolume(bottleVolume - transferredMl);

      if (cylinderHit?.hit && cylinderVolume < 50) {
        const accepted = Math.min(transferredMl, 50 - cylinderVolume);
        setCylinderVolume(cylinderVolume + accepted);
        if (accepted < transferredMl) {
          recordSpill({
            volumeMl: transferredMl - accepted,
            position: [cylinderHit.point.x, TABLE_TOP_Y + 0.008, cylinderHit.point.z],
          });
        }
        setTelemetry({
          rate,
          squeezePressure: pressureRef.current,
          destination: 'cylinder',
          operation: 'wash-to-cylinder',
        });
      } else {
        const point = benchHit?.point ?? nozzleWorld;
        recordSpill({ volumeMl: transferredMl, position: [point.x, TABLE_TOP_Y + 0.008, point.z] });
        setTelemetry({
          rate,
          squeezePressure: pressureRef.current,
          destination: 'bench',
          operation: 'wash-to-cylinder',
        });
      }

      if (performance.now() - lastLogAt.current > 650) {
        lastLogAt.current = performance.now();
        log({
          type: cylinderHit?.hit ? 'TRANSFER' : 'SPILL',
          payload: { source: 'washBottle', target: cylinderHit?.hit ? 'cylinder50' : 'bench', rateMlPerSec: rate },
        });
      }
    } else {
      streamState.current.active = false;
      if (heldRef.current || pressureRef.current > 0.01) {
        setTelemetry({
          rate: 0,
          squeezePressure: pressureRef.current,
          destination: 'none',
          operation: 'wash-to-cylinder',
        });
      }
    }
  });

  return (
    <>
      <RigidBody
        ref={bodyRef}
        type={held || docked ? 'kinematicPosition' : 'dynamic'}
        colliders={false}
        position={START_POSITION}
        mass={0.24}
        linearDamping={2.2}
        angularDamping={3.2}
        canSleep={!held}
      >
        <CylinderCollider args={[0.078, 0.043]} position={[0, -0.002, 0]} />
        <group
          onPointerDown={(event) => {
            event.stopPropagation();
            setDocked(false);
            updatePointer(event);
            heldRef.current = true;
            setHeld(true);
            setHeldInstrument('washBottle');
            log({ type: 'PICK', payload: { id: 'washBottle' } });
            gl.domElement.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!heldRef.current) return;
            event.stopPropagation();
            updatePointer(event);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            squeezeRef.current = false;
            heldRef.current = false;
            setHeld(false);
            setHeldInstrument(null);
            streamState.current.active = false;
            log({ type: 'DROP', payload: { id: 'washBottle' } });
            gl.domElement.releasePointerCapture(event.pointerId);
          }}
        >
          <PlasticwareModel url="/models/wash-bottle-250ml.glb" />
        </group>
      </RigidBody>
      <LiquidStream state={streamState} />
    </>
  );
}
