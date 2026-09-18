import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { getSphereTarget } from '../engine/spatialRegistry';
import { useSimulationStore } from '../store/useSimulationStore';
import { RubberwareModel } from './RubberwareModel';
import { INSTRUMENT_HOME } from '../scene/labLayout';

const START_POSITION: [number, number, number] = [...INSTRUMENT_HOME.pipetteBulb];
const DRAG_Y = 1.17;

export function PipetteBulb() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  const pointerRef = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y));
  const hitPoint = useRef(new THREE.Vector3());
  const bulbPosition = useMemo(() => new THREE.Vector3(), []);

  const attached = useSimulationStore((s) => s.pipetteBulbAttached);
  const resetVersion = useSimulationStore((s) => s.resetVersion);
  const setAttached = useSimulationStore((s) => s.setPipetteBulbAttached);
  const setHeldInstrument = useSimulationStore((s) => s.setHeldInstrument);
  const setPipetteTelemetry = useSimulationStore((s) => s.setPipetteTelemetry);
  const log = useSimulationStore((s) => s.log);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    heldRef.current = false;
    setHeld(false);
    body.setTranslation({ x: START_POSITION[0], y: START_POSITION[1], z: START_POSITION[2] }, true);
  }, [resetVersion]);

  const updatePointer = (event: ThreeEvent<PointerEvent>) => {
    const rect = gl.domElement.getBoundingClientRect();
    pointerRef.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  };

  useFrame(() => {
    const body = bodyRef.current;
    if (!body || attached) return;
    if (heldRef.current) {
      raycaster.current.setFromCamera(pointerRef.current, camera);
      if (raycaster.current.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
        body.setNextKinematicTranslation({
          x: THREE.MathUtils.clamp(hitPoint.current.x, -0.48, 0.50),
          y: DRAG_Y,
          z: THREE.MathUtils.clamp(hitPoint.current.z, -0.30, 0.30),
        });
      }
    }
  });

  if (attached) return null;

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders="ball" position={START_POSITION}>
      <group
        onPointerDown={(event) => {
          event.stopPropagation();
          updatePointer(event);
          heldRef.current = true;
          setHeld(true);
          setHeldInstrument('pipetteBulb');
          log({ type: 'PICK', payload: { id: 'pipetteBulb' } });
          gl.domElement.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!heldRef.current) return;
          event.stopPropagation();
          updatePointer(event);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          const body = bodyRef.current;
          if (body) {
            const t = body.translation();
            bulbPosition.set(t.x, t.y, t.z);
            const target = getSphereTarget('pipetteTop');
            if (target?.enabled && bulbPosition.distanceTo(target.center) <= target.radius + 0.025) {
              setAttached(true);
              setPipetteTelemetry({ operation: 'attach-bulb', rate: 0 });
              log({ type: 'ATTACH', payload: { source: 'pipetteBulb', target: 'pipette5' } });
            }
          }
          heldRef.current = false;
          setHeld(false);
          setHeldInstrument(null);
          log({ type: 'DROP', payload: { id: 'pipetteBulb' } });
          gl.domElement.releasePointerCapture(event.pointerId);
        }}
      >
        <RubberwareModel url="/models/pipette-bulb.glb" />
      </group>
    </RigidBody>
  );
}
