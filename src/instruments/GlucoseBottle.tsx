import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { CylinderCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { smoothDragTarget } from '../interaction/smoothDrag';
import { updateSphereTarget } from '../engine/spatialRegistry';
import { INSTRUMENT_HOME } from '../scene/labLayout';
import { useSimulationStore } from '../store/useSimulationStore';
import { LabSolidModel } from './LabSolidModel';

const START_POSITION: [number, number, number] = [...INSTRUMENT_HOME.glucoseBottle];
const DRAG_Y = 0.96;
const LOCAL_POWDER_CENTER = new THREE.Vector3(0, 0.035, 0);

export function GlucoseBottle() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const [held, setHeld] = useState(false);
  const [docked, setDocked] = useState(true);
  const heldRef = useRef(false);
  const pointerRef = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y));
  const hitPoint = useRef(new THREE.Vector3());
  const bodyPosition = useMemo(() => new THREE.Vector3(), []);
  const powderTop = useMemo(() => new THREE.Vector3(), []);

  const remainingMass = useSimulationStore((s) => s.glucoseBottleMassG);
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
          x: THREE.MathUtils.clamp(hitPoint.current.x, -0.52, 0.52),
          y: DRAG_Y,
          z: THREE.MathUtils.clamp(hitPoint.current.z, -0.34, 0.34),
        }, delta));
        body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 });
      }
    }

    const t = body.translation();
    bodyPosition.set(t.x, t.y, t.z);
    powderTop.copy(LOCAL_POWDER_CENTER).add(bodyPosition);
    updateSphereTarget('glucosePowder', {
      center: powderTop,
      radius: 0.032,
      enabled: remainingMass > 0.01,
    });
  });

  const fillScale = THREE.MathUtils.clamp(remainingMass / 50, 0, 1);

  return (
    <RigidBody
      ref={bodyRef}
      type={held || docked ? 'kinematicPosition' : 'dynamic'}
      colliders={false}
      position={START_POSITION}
      mass={0.28}
      linearDamping={2.5}
      angularDamping={5.5}
      canSleep={!held}
    >
      <CylinderCollider args={[0.066, 0.034]} position={[0, 0.011, 0]} />
      <group
        onPointerDown={(event) => {
          event.stopPropagation();
          setDocked(false);
          updatePointer(event);
          heldRef.current = true;
          setHeld(true);
          setHeldInstrument('glucoseBottle');
          log({ type: 'PICK', payload: { id: 'glucoseBottle' } });
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
          log({ type: 'DROP', payload: { id: 'glucoseBottle' } });
          gl.domElement.releasePointerCapture(event.pointerId);
        }}
      >
        <LabSolidModel url="/models/glucose-reagent-bottle.glb" preset="bottle" />
        <mesh position={[0, -0.045 + fillScale * 0.035, 0]}>
          <cylinderGeometry args={[0.029, 0.029, Math.max(0.004, fillScale * 0.06), 64]} />
          <meshStandardMaterial color="#f5f4ec" roughness={0.94} />
        </mesh>
      </group>
    </RigidBody>
  );
}
