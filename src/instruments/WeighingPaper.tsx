import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { CuboidCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { findBallisticOpeningHit, findBallisticPlaneOpeningHit } from '../engine/liquid';
import { calculatePowderPourRateGPerSec, transferMass } from '../engine/powder';
import { getOpeningTarget, updateOpeningTarget } from '../engine/spatialRegistry';
import { useSimulationStore } from '../store/useSimulationStore';
import { BALANCE_PAN_CENTER, BALANCE_PAN_RADIUS } from './ElectronicBalance';
import { PowderStream, type PowderStreamState } from './PowderStream';
import { INSTRUMENT_HOME } from '../scene/labLayout';

const TABLE_TOP_Y = 0.85;
const START_POSITION: [number, number, number] = [...INSTRUMENT_HOME.weighingPaper];
const DRAG_Y = 1.01;
const HALF_SIZE = 0.043;
const LOCAL_EXIT = new THREE.Vector3(HALF_SIZE, 0.002, 0);

export function WeighingPaper() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const [held, setHeld] = useState(false);
  const [docked, setDocked] = useState(true);
  const heldRef = useRef(false);
  const tiltRef = useRef(0);
  const pointerRef = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y));
  const hitPoint = useRef(new THREE.Vector3());
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const centerWorld = useMemo(() => new THREE.Vector3(), []);
  const normalWorld = useMemo(() => new THREE.Vector3(), []);
  const exitWorld = useMemo(() => new THREE.Vector3(), []);
  const exitDirection = useMemo(() => new THREE.Vector3(), []);
  const benchCenter = useMemo(() => new THREE.Vector3(0, TABLE_TOP_Y + 0.006, 0), []);
  const streamState = useRef<PowderStreamState>({
    active: false,
    start: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    endTime: 0.35,
    intensity: 0,
  });
  const lastLogAt = useRef(0);
  const lastOnBalanceRef = useRef(false);

  const powderMass = useSimulationStore((s) => s.paperGlucoseMassG);
  const tubeMass = useSimulationStore((s) => s.tubeGlucoseMassG);
  const resetVersion = useSimulationStore((s) => s.resetVersion);
  const setPowderMass = useSimulationStore((s) => s.setPaperGlucoseMass);
  const setTubeMass = useSimulationStore((s) => s.setTubeGlucoseMass);
  const setPaperOnBalance = useSimulationStore((s) => s.setPaperOnBalance);
  const recordPowderSpill = useSimulationStore((s) => s.recordPowderSpill);
  const setPowderTelemetry = useSimulationStore((s) => s.setPowderTelemetry);
  const setHeldInstrument = useSimulationStore((s) => s.setHeldInstrument);
  const log = useSimulationStore((s) => s.log);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    heldRef.current = false;
    tiltRef.current = 0;
    setHeld(false);
    setDocked(true);
    lastOnBalanceRef.current = false;
    setPaperOnBalance(false);
    setHeldInstrument(null);
    body.setTranslation({ x: START_POSITION[0], y: START_POSITION[1], z: START_POSITION[2] }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, [resetVersion, setHeldInstrument, setPaperOnBalance]);

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
          x: THREE.MathUtils.clamp(hitPoint.current.x, -0.56, 0.52),
          y: DRAG_Y,
          z: THREE.MathUtils.clamp(hitPoint.current.z, -0.34, 0.34),
        });
        quaternion.setFromEuler(new THREE.Euler(0, 0, tiltRef.current));
        body.setNextKinematicRotation(quaternion);
      }
    }

    const t = body.translation();
    const r = body.rotation();
    position.set(t.x, t.y, t.z);
    quaternion.set(r.x, r.y, r.z, r.w);
    centerWorld.copy(position);
    normalWorld.set(0, 1, 0).applyQuaternion(quaternion).normalize();

    updateOpeningTarget('weighingPaper', {
      center: centerWorld,
      normal: normalWorld,
      radius: HALF_SIZE * 0.88,
      enabled: !heldRef.current ? normalWorld.y > 0.72 : normalWorld.y > 0.55,
    });

    const dx = position.x - BALANCE_PAN_CENTER.x;
    const dz = position.z - BALANCE_PAN_CENTER.z;
    const overPan = dx * dx + dz * dz <= BALANCE_PAN_RADIUS * BALANCE_PAN_RADIUS;
    const nearPanHeight = position.y > 0.885 && position.y < 0.955;
    const onPan = !heldRef.current && overPan && nearPanHeight && normalWorld.y > 0.88;
    if (onPan !== lastOnBalanceRef.current) {
      lastOnBalanceRef.current = onPan;
      setPaperOnBalance(onPan);
    }

    exitWorld.copy(LOCAL_EXIT).applyQuaternion(quaternion).add(position);
    exitDirection.set(1, -0.05, 0).applyQuaternion(quaternion).normalize();
    const rate = heldRef.current ? calculatePowderPourRateGPerSec(tiltRef.current, powderMass, 0.55) : 0;

    if (rate > 0.002 && powderMass > 0) {
      const velocity = exitDirection.clone().multiplyScalar(0.10);
      const tubeOpening = getOpeningTarget('testTube');
      const tubeHit = tubeOpening?.enabled
        ? findBallisticPlaneOpeningHit(exitWorld, velocity, tubeOpening)
        : null;
      const benchHit = findBallisticOpeningHit(exitWorld, velocity, { center: benchCenter, radius: 10, y: benchCenter.y });
      const endTime = tubeHit?.hit ? tubeHit.time : benchHit?.time ?? 0.34;

      streamState.current.active = true;
      streamState.current.start.copy(exitWorld);
      streamState.current.velocity.copy(velocity);
      streamState.current.endTime = THREE.MathUtils.clamp(endTime, 0.05, 0.58);
      streamState.current.intensity = THREE.MathUtils.clamp(rate / 0.55, 0.1, 1);

      const { transferredG } = transferMass(powderMass, rate * delta);
      setPowderMass(powderMass - transferredG);
      if (tubeHit?.hit) {
        setTubeMass(tubeMass + transferredG);
      } else {
        const point = benchHit?.point ?? exitWorld;
        recordPowderSpill({ massG: transferredG, position: [point.x, TABLE_TOP_Y + 0.006, point.z] });
      }
      setPowderTelemetry({ rate, operation: 'paper-to-tube' });
      if (performance.now() - lastLogAt.current > 700) {
        lastLogAt.current = performance.now();
        log({ type: 'POWDER_TRANSFER', payload: { source: 'weighingPaper', target: tubeHit?.hit ? 'testTube' : 'bench' } });
      }
    } else {
      streamState.current.active = false;
    }
  });

  const pileScale = THREE.MathUtils.clamp(powderMass / 2.05, 0, 1.2);

  return (
    <>
      <RigidBody
        ref={bodyRef}
        type={held || docked ? 'kinematicPosition' : 'dynamic'}
        colliders={false}
        position={START_POSITION}
        mass={0.004}
        linearDamping={3}
        angularDamping={5}
      >
        <CuboidCollider args={[HALF_SIZE, 0.0013, HALF_SIZE]} />
        <group
          onPointerDown={(event) => {
            event.stopPropagation();
            setDocked(false);
            updatePointer(event);
            heldRef.current = true;
            setHeld(true);
            setPaperOnBalance(false);
            setHeldInstrument('weighingPaper');
            log({ type: 'PICK', payload: { id: 'weighingPaper' } });
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
            log({ type: 'DROP', payload: { id: 'weighingPaper' } });
            gl.domElement.releasePointerCapture(event.pointerId);
          }}
          onWheel={(event) => {
            if (!heldRef.current) return;
            event.stopPropagation();
            const dir = event.deltaY > 0 ? -1 : 1;
            tiltRef.current = THREE.MathUtils.clamp(
              tiltRef.current + dir * THREE.MathUtils.degToRad(5),
              THREE.MathUtils.degToRad(-82),
              THREE.MathUtils.degToRad(8),
            );
          }}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[HALF_SIZE * 2, 0.002, HALF_SIZE * 2]} />
            <meshStandardMaterial color="#f8f6ed" roughness={0.92} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[HALF_SIZE - 0.002, 0.004, 0]} rotation={[0, 0, -0.22]}>
            <boxGeometry args={[0.005, 0.014, HALF_SIZE * 2]} />
            <meshStandardMaterial color="#efece0" roughness={0.94} />
          </mesh>
          <mesh position={[-HALF_SIZE + 0.002, 0.004, 0]} rotation={[0, 0, 0.22]}>
            <boxGeometry args={[0.005, 0.014, HALF_SIZE * 2]} />
            <meshStandardMaterial color="#efece0" roughness={0.94} />
          </mesh>
          {powderMass > 0.001 && (
            <mesh position={[0.006, 0.006, 0]} scale={[1.1, 0.55 + pileScale * 0.9, 0.92]} castShadow>
              <sphereGeometry args={[0.024 * Math.sqrt(Math.max(0.08, pileScale)), 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#f4f3eb" roughness={0.97} />
            </mesh>
          )}
        </group>
      </RigidBody>
      <PowderStream state={streamState} />
    </>
  );
}
