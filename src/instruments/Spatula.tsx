import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { CuboidCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { calculateScoopRateGPerSec, calculatePowderPourRateGPerSec, transferMass } from '../engine/powder';
import { findBallisticOpeningHit, findBallisticPlaneOpeningHit } from '../engine/liquid';
import { getOpeningTarget, getSphereTarget } from '../engine/spatialRegistry';
import { useSimulationStore } from '../store/useSimulationStore';
import { LabSolidModel } from './LabSolidModel';
import { PowderStream, type PowderStreamState } from './PowderStream';
import { INSTRUMENT_HOME } from '../scene/labLayout';

const TABLE_TOP_Y = 0.85;
const START_POSITION: [number, number, number] = [...INSTRUMENT_HOME.spatula];
const DRAG_Y = 1.02;
const LOCAL_BLADE_CENTER = new THREE.Vector3(0.083, 0.008, 0);
const LOCAL_BLADE_TIP = new THREE.Vector3(0.102, 0.006, 0);

export function Spatula() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const [held, setHeld] = useState(false);
  const [docked, setDocked] = useState(true);
  const heldRef = useRef(false);
  const scoopRef = useRef(false);
  const scoopPressureRef = useRef(0);
  const tiltRef = useRef(0);
  const pointerRef = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y));
  const hitPoint = useRef(new THREE.Vector3());
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const bladeCenterWorld = useMemo(() => new THREE.Vector3(), []);
  const bladeTipWorld = useMemo(() => new THREE.Vector3(), []);
  const bladeDirection = useMemo(() => new THREE.Vector3(), []);
  const benchCenter = useMemo(() => new THREE.Vector3(0, TABLE_TOP_Y + 0.005, 0), []);
  const streamState = useRef<PowderStreamState>({
    active: false,
    start: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    endTime: 0.35,
    intensity: 0,
  });
  const lastLogAt = useRef(0);

  const bottleMass = useSimulationStore((s) => s.glucoseBottleMassG);
  const spatulaMass = useSimulationStore((s) => s.spatulaPowderMassG);
  const paperMass = useSimulationStore((s) => s.paperGlucoseMassG);
  const resetVersion = useSimulationStore((s) => s.resetVersion);
  const setBottleMass = useSimulationStore((s) => s.setGlucoseBottleMass);
  const setSpatulaMass = useSimulationStore((s) => s.setSpatulaPowderMass);
  const setPaperMass = useSimulationStore((s) => s.setPaperGlucoseMass);
  const recordPowderSpill = useSimulationStore((s) => s.recordPowderSpill);
  const setPowderTelemetry = useSimulationStore((s) => s.setPowderTelemetry);
  const setHeldInstrument = useSimulationStore((s) => s.setHeldInstrument);
  const log = useSimulationStore((s) => s.log);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!heldRef.current || event.code !== 'Space') return;
      event.preventDefault();
      scoopRef.current = true;
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') scoopRef.current = false;
    };
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    heldRef.current = false;
    scoopRef.current = false;
    scoopPressureRef.current = 0;
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
    bladeCenterWorld.copy(LOCAL_BLADE_CENTER).applyQuaternion(quaternion).add(position);
    bladeTipWorld.copy(LOCAL_BLADE_TIP).applyQuaternion(quaternion).add(position);
    bladeDirection.set(1, -0.04, 0).applyQuaternion(quaternion).normalize();

    const glucoseZone = getSphereTarget('glucosePowder');
    const inPowder = Boolean(glucoseZone?.enabled && bladeCenterWorld.distanceTo(glucoseZone.center) <= glucoseZone.radius);
    const scoopTarget = scoopRef.current && heldRef.current && inPowder && spatulaMass < 0.75 ? 1 : 0;
    scoopPressureRef.current = THREE.MathUtils.damp(scoopPressureRef.current, scoopTarget, 12, delta);

    if (scoopPressureRef.current > 0.03 && bottleMass > 0 && spatulaMass < 0.75) {
      const scoopRate = calculateScoopRateGPerSec(scoopPressureRef.current, bottleMass);
      const availableCapacity = 0.75 - spatulaMass;
      const moved = Math.min(scoopRate * delta, bottleMass, availableCapacity);
      if (moved > 0) {
        setBottleMass(bottleMass - moved);
        setSpatulaMass(spatulaMass + moved);
        setPowderTelemetry({ rate: scoopRate, operation: 'scoop' });
        if (performance.now() - lastLogAt.current > 700) {
          lastLogAt.current = performance.now();
          log({ type: 'SCOOP', payload: { massG: moved, spatulaMassG: spatulaMass + moved } });
        }
      }
      streamState.current.active = false;
      return;
    }

    const pourRate = heldRef.current && !scoopRef.current
      ? calculatePowderPourRateGPerSec(tiltRef.current, spatulaMass, 0.38)
      : 0;

    if (pourRate > 0.002 && spatulaMass > 0) {
      const velocity = bladeDirection.clone().multiplyScalar(0.08);
      velocity.y -= 0.015;
      const paperTarget = getOpeningTarget('weighingPaper');
      const paperHit = paperTarget?.enabled
        ? findBallisticPlaneOpeningHit(bladeTipWorld, velocity, paperTarget)
        : null;
      const benchHit = findBallisticOpeningHit(bladeTipWorld, velocity, {
        center: benchCenter,
        radius: 10,
        y: benchCenter.y,
      });

      const endTime = paperHit?.hit ? paperHit.time : benchHit?.time ?? 0.33;
      streamState.current.active = true;
      streamState.current.start.copy(bladeTipWorld);
      streamState.current.velocity.copy(velocity);
      streamState.current.endTime = THREE.MathUtils.clamp(endTime, 0.05, 0.55);
      streamState.current.intensity = THREE.MathUtils.clamp(pourRate / 0.38, 0.1, 1);

      const { transferredG } = transferMass(spatulaMass, pourRate * delta);
      setSpatulaMass(spatulaMass - transferredG);
      if (paperHit?.hit) {
        setPaperMass(paperMass + transferredG);
      } else {
        const point = benchHit?.point ?? bladeTipWorld;
        recordPowderSpill({ massG: transferredG, position: [point.x, TABLE_TOP_Y + 0.006, point.z] });
      }
      setPowderTelemetry({ rate: pourRate, operation: 'spatula-to-paper' });
      if (performance.now() - lastLogAt.current > 700) {
        lastLogAt.current = performance.now();
        log({ type: 'POWDER_TRANSFER', payload: { source: 'spatula', target: paperHit?.hit ? 'weighingPaper' : 'bench' } });
      }
    } else {
      streamState.current.active = false;
      if (heldRef.current) setPowderTelemetry({ rate: 0, operation: 'none' });
    }
  });

  const powderScale = THREE.MathUtils.clamp(spatulaMass / 0.75, 0, 1);

  return (
    <>
      <RigidBody
        ref={bodyRef}
        type={held || docked ? 'kinematicPosition' : 'dynamic'}
        colliders={false}
        position={START_POSITION}
        mass={0.055}
        linearDamping={2.2}
        angularDamping={4}
      >
        <CuboidCollider args={[0.077, 0.005, 0.012]} />
        <group
          onPointerDown={(event) => {
            event.stopPropagation();
            setDocked(false);
            updatePointer(event);
            heldRef.current = true;
            setHeld(true);
            setHeldInstrument('spatula');
            log({ type: 'PICK', payload: { id: 'spatula' } });
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
            scoopRef.current = false;
            setHeld(false);
            setHeldInstrument(null);
            streamState.current.active = false;
            log({ type: 'DROP', payload: { id: 'spatula' } });
            gl.domElement.releasePointerCapture(event.pointerId);
          }}
          onWheel={(event) => {
            if (!heldRef.current) return;
            event.stopPropagation();
            const dir = event.deltaY > 0 ? -1 : 1;
            tiltRef.current = THREE.MathUtils.clamp(
              tiltRef.current + dir * THREE.MathUtils.degToRad(5),
              THREE.MathUtils.degToRad(-84),
              THREE.MathUtils.degToRad(8),
            );
          }}
        >
          <LabSolidModel url="/models/lab-spatula.glb" preset="metal" />
          {spatulaMass > 0.002 && (
            <mesh position={[0.083, 0.008, 0]} scale={[1, 0.5 + powderScale * 0.9, 1]} castShadow>
              <sphereGeometry args={[0.0115 * Math.sqrt(Math.max(0.08, powderScale)), 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#f4f3eb" roughness={0.96} />
            </mesh>
          )}
        </group>
      </RigidBody>
      <PowderStream state={streamState} />
    </>
  );
}
