import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { CylinderCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { InstrumentHitArea } from '../interaction/InstrumentHitArea';
import { smoothDragTarget } from '../interaction/smoothDrag';
import { findBallisticOpeningHit } from '../engine/liquid';
import { getOpeningTarget, getSphereTarget, updateSphereTarget } from '../engine/spatialRegistry';
import { useSimulationStore } from '../store/useSimulationStore';
import { GlasswareModel } from './GlasswareModel';
import { LiquidStream, type LiquidStreamState } from './LiquidStream';
import { RubberwareModel } from './RubberwareModel';
import { WorldSpaceLiquid } from './WorldSpaceLiquid';
import { INSTRUMENT_HOME } from '../scene/labLayout';

const TABLE_TOP_Y = 0.85;
const START_POSITION: [number, number, number] = [...INSTRUMENT_HOME.graduatedPipette5];
const MIN_CENTER_Y = 1.045;
const MAX_CENTER_Y = 1.205;
const PIPETTE_INNER_RADIUS = 0.00265;
const PIPETTE_CAVITY_BOTTOM = -0.108;
const PIPETTE_CAVITY_TOP = 0.116;
const PIPETTE_CAVITY_HEIGHT = PIPETTE_CAVITY_TOP - PIPETTE_CAVITY_BOTTOM;
const PIPETTE_CAVITY_CENTER = (PIPETTE_CAVITY_TOP + PIPETTE_CAVITY_BOTTOM) / 2;
const TIP_LOCAL_Y = -0.143;
const TOP_LOCAL_Y = 0.132;
const CAPACITY_ML = 5;

function PipetteGraduations() {
  const marks = useMemo(() => Array.from({ length: 51 }, (_, i) => i), []);
  return (
    <group>
      {marks.map((i) => {
        const reading = i / 10;
        const y = PIPETTE_CAVITY_TOP - (reading / 5) * PIPETTE_CAVITY_HEIGHT;
        const major = i % 10 === 0;
        const medium = i % 5 === 0;
        return (
          <mesh key={i} position={[0, y, 0.00355]}>
            <boxGeometry args={[major ? 0.0065 : medium ? 0.0050 : 0.0033, major ? 0.00038 : 0.00025, 0.00035]} />
            <meshStandardMaterial color={major ? '#426f84' : '#7293a2'} roughness={0.48} />
          </mesh>
        );
      })}
    </group>
  );
}

export function GraduatedPipette() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  const aspirateKeyRef = useRef(false);
  const dispenseKeyRef = useRef(false);
  const suctionRef = useRef(0);
  const dispenseRef = useRef(0);
  const heightRef = useRef(START_POSITION[1]);
  const pointerRef = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -START_POSITION[1]));
  const hitPoint = useRef(new THREE.Vector3());
  const position = useMemo(() => new THREE.Vector3(), []);
  const tipWorld = useMemo(() => new THREE.Vector3(), []);
  const topWorld = useMemo(() => new THREE.Vector3(), []);
  const controlOffset = useMemo(() => new THREE.Vector3(), []);
  const streamState = useRef<LiquidStreamState>({
    active: false,
    start: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    endTime: 0.18,
    radius: 0.00075,
  });
  const lastLogAt = useRef(0);

  const pipetteVolume = useSimulationStore((s) => s.pipetteVolumeMl);
  const flaskVolume = useSimulationStore((s) => s.standardFlaskVolumeMl);
  const controlVolume = useSimulationStore((s) => s.controlTubeVolumeMl);
  const controlStandard = useSimulationStore((s) => s.controlStandardVolumeMl);
  const bulbAttached = useSimulationStore((s) => s.pipetteBulbAttached);
  const resetVersion = useSimulationStore((s) => s.resetVersion);
  const setPipetteVolume = useSimulationStore((s) => s.setPipetteVolume);
  const setFlaskVolume = useSimulationStore((s) => s.setStandardFlaskVolume);
  const setControlVolume = useSimulationStore((s) => s.setControlTubeVolume);
  const setControlStandard = useSimulationStore((s) => s.setControlStandardVolume);
  const recordSpill = useSimulationStore((s) => s.recordSpill);
  const setHeldInstrument = useSimulationStore((s) => s.setHeldInstrument);
  const setPipetteTelemetry = useSimulationStore((s) => s.setPipetteTelemetry);
  const log = useSimulationStore((s) => s.log);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!heldRef.current) return;
      if (event.code === 'Space') {
        event.preventDefault();
        aspirateKeyRef.current = true;
      }
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        dispenseKeyRef.current = true;
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') aspirateKeyRef.current = false;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') dispenseKeyRef.current = false;
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
    aspirateKeyRef.current = false;
    dispenseKeyRef.current = false;
    suctionRef.current = 0;
    dispenseRef.current = 0;
    heightRef.current = START_POSITION[1];
    setHeld(false);
    body.setTranslation({ x: START_POSITION[0], y: START_POSITION[1], z: START_POSITION[2] }, true);
    setPipetteTelemetry({ suction01: 0, dispense01: 0, rate: 0, operation: 'none' });
  }, [resetVersion, setPipetteTelemetry]);

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
      dragPlane.current.constant = -heightRef.current;
      raycaster.current.setFromCamera(pointerRef.current, camera);
      if (raycaster.current.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
        body.setNextKinematicTranslation(smoothDragTarget(body, {
          x: THREE.MathUtils.clamp(hitPoint.current.x, -0.54, 0.48),
          y: heightRef.current,
          z: THREE.MathUtils.clamp(hitPoint.current.z, -0.31, 0.31),
        }, delta));
      }
    }

    const t = body.translation();
    position.set(t.x, t.y, t.z);
    tipWorld.set(t.x, t.y + TIP_LOCAL_Y, t.z);
    topWorld.set(t.x, t.y + TOP_LOCAL_Y, t.z);
    updateSphereTarget('pipetteTop', { center: topWorld, radius: 0.022, enabled: !bulbAttached });

    const standardSolution = getSphereTarget('standardSolution');
    const tipInStandard = Boolean(
      standardSolution?.enabled && tipWorld.distanceTo(standardSolution.center) <= standardSolution.radius,
    );

    const aspirateTarget = heldRef.current && aspirateKeyRef.current && bulbAttached && tipInStandard && pipetteVolume < CAPACITY_ML && flaskVolume > 0
      ? 1
      : 0;
    suctionRef.current = THREE.MathUtils.damp(suctionRef.current, aspirateTarget, 10, delta);

    if (suctionRef.current > 0.025 && aspirateTarget > 0) {
      const rate = THREE.MathUtils.lerp(0.22, 1.55, suctionRef.current);
      const moved = Math.min(rate * delta, CAPACITY_ML - pipetteVolume, flaskVolume);
      if (moved > 0) {
        setPipetteVolume(pipetteVolume + moved);
        setFlaskVolume(flaskVolume - moved);
        setPipetteTelemetry({ suction01: suctionRef.current, dispense01: 0, rate, operation: 'aspirate' });
        if (performance.now() - lastLogAt.current > 650) {
          lastLogAt.current = performance.now();
          log({ type: 'ASPIRATE', payload: { volumeMl: moved, pipetteVolumeMl: pipetteVolume + moved } });
        }
      }
      streamState.current.active = false;
      return;
    }

    const dispenseTarget = heldRef.current && dispenseKeyRef.current && pipetteVolume > 0 ? 1 : 0;
    dispenseRef.current = THREE.MathUtils.damp(dispenseRef.current, dispenseTarget, 12, delta);

    if (dispenseRef.current > 0.025 && dispenseTarget > 0) {
      const rate = THREE.MathUtils.lerp(0.18, 1.28, dispenseRef.current);
      const moved = Math.min(rate * delta, pipetteVolume);
      const control = getOpeningTarget('controlTube');
      let hitsControl = false;
      if (control?.enabled) {
        controlOffset.copy(tipWorld).sub(control.center);
        const normalDistance = control.normal.dot(controlOffset);
        controlOffset.addScaledVector(control.normal, -normalDistance);
        hitsControl = controlOffset.lengthSq() <= Math.pow(control.radius * 0.88, 2) && normalDistance > -0.018 && normalDistance < 0.055;
      }

      setPipetteVolume(pipetteVolume - moved);
      streamState.current.active = true;
      streamState.current.start.copy(tipWorld);
      streamState.current.velocity.set(0, -0.08, 0);
      streamState.current.radius = 0.00072;

      if (hitsControl && control) {
        const accepted = Math.min(moved, 50 - controlVolume);
        setControlVolume(controlVolume + accepted);
        setControlStandard(controlStandard + accepted);
        streamState.current.endTime = 0.055;
        if (accepted < moved) {
          recordSpill({
            liquid: 'standardSulfate',
            volumeMl: moved - accepted,
            position: [control.center.x, TABLE_TOP_Y + 0.007, control.center.z],
          });
        }
      } else {
        const benchHit = findBallisticOpeningHit(tipWorld, new THREE.Vector3(0, -0.08, 0), {
          center: new THREE.Vector3(0, TABLE_TOP_Y + 0.006, 0),
          radius: 10,
          y: TABLE_TOP_Y + 0.006,
        });
        streamState.current.endTime = THREE.MathUtils.clamp(benchHit?.time ?? 0.18, 0.055, 0.28);
        const point = benchHit?.point ?? tipWorld;
        recordSpill({ liquid: 'standardSulfate', volumeMl: moved, position: [point.x, TABLE_TOP_Y + 0.007, point.z] });
      }

      setPipetteTelemetry({ suction01: 0, dispense01: dispenseRef.current, rate, operation: 'dispense' });
      if (performance.now() - lastLogAt.current > 650) {
        lastLogAt.current = performance.now();
        log({ type: 'DISPENSE', payload: { volumeMl: moved, target: hitsControl ? 'controlTube' : 'bench' } });
      }
      return;
    }

    streamState.current.active = false;
    if (!aspirateKeyRef.current && !dispenseKeyRef.current) {
      setPipetteTelemetry({
        suction01: suctionRef.current,
        dispense01: dispenseRef.current,
        rate: 0,
        operation: 'none',
      });
    }
  });

  const readingMl = THREE.MathUtils.clamp(CAPACITY_ML - pipetteVolume, 0, 5);

  return (
    <>
      <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={START_POSITION}>
        <CylinderCollider args={[0.135, 0.0045]} />
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
            updatePointer(event);
            heldRef.current = true;
            setHeld(true);
            setHeldInstrument('pipette5');
            log({ type: 'PICK', payload: { id: 'pipette5' } });
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
            aspirateKeyRef.current = false;
            dispenseKeyRef.current = false;
            setHeld(false);
            setHeldInstrument(null);
            streamState.current.active = false;
            log({ type: 'DROP', payload: { id: 'pipette5', readingMl } });
            gl.domElement.releasePointerCapture(event.pointerId);
          }}
          onWheel={(event) => {
            if (!heldRef.current) return;
            event.stopPropagation();
            heightRef.current = THREE.MathUtils.clamp(
              heightRef.current + (event.deltaY > 0 ? -0.012 : 0.012),
              MIN_CENTER_Y,
              MAX_CENTER_Y,
            );
          }}
        >
          <InstrumentHitArea size={[0.04, 0.31, 0.04]} />
        <GlasswareModel url="/models/graduated-pipette-5ml.glb" />
          <PipetteGraduations />
          <WorldSpaceLiquid
            radius={PIPETTE_INNER_RADIUS * 0.88}
            cavityHeight={PIPETTE_CAVITY_HEIGHT}
            centerY={PIPETTE_CAVITY_CENTER}
            volumeMl={pipetteVolume}
            physicalCapacityMl={CAPACITY_ML}
            color="#d6efff"
          />
          {bulbAttached && (
            <group position={[0, 0.150, 0]} scale={0.88}>
              <RubberwareModel url="/models/pipette-bulb.glb" />
            </group>
          )}
        </group>
      </RigidBody>
      <LiquidStream state={streamState} />
    </>
  );
}
