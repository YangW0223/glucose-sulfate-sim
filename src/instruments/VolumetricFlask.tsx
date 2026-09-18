import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { BallCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { smoothDragTarget } from '../interaction/smoothDrag';
import { updateOpeningTarget, updateSphereTarget } from '../engine/spatialRegistry';
import { useSimulationStore } from '../store/useSimulationStore';
import { GlasswareModel } from './GlasswareModel';
import { INSTRUMENT_HOME } from '../scene/labLayout';

const START_POSITION: [number, number, number] = [...INSTRUMENT_HOME.volumetricFlask];
const DRAG_Y = 0.925;
const LOCAL_SOLUTION_CENTER = new THREE.Vector3(0, -0.022, 0);
const LOCAL_OPENING_CENTER = new THREE.Vector3(0, 0.130, 0);

export function VolumetricFlask() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  const pointerRef = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y));
  const hitPoint = useRef(new THREE.Vector3());
  const bodyPosition = useMemo(() => new THREE.Vector3(), []);
  const solutionWorld = useMemo(() => new THREE.Vector3(), []);
  const openingWorld = useMemo(() => new THREE.Vector3(), []);
  const volume = useSimulationStore((s) => s.standardFlaskVolumeMl);
  const resetVersion = useSimulationStore((s) => s.resetVersion);
  const setHeldInstrument = useSimulationStore((s) => s.setHeldInstrument);
  const log = useSimulationStore((s) => s.log);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    heldRef.current = false;
    setHeld(false);
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
          x: THREE.MathUtils.clamp(hitPoint.current.x, -0.54, 0.22),
          y: DRAG_Y,
          z: THREE.MathUtils.clamp(hitPoint.current.z, -0.28, 0.30),
        }, delta));
        body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 });
      }
    }
    const t = body.translation();
    bodyPosition.set(t.x, t.y, t.z);
    solutionWorld.copy(LOCAL_SOLUTION_CENTER).add(bodyPosition);
    openingWorld.copy(LOCAL_OPENING_CENTER).add(bodyPosition);
    updateSphereTarget('standardSolution', {
      center: solutionWorld,
      radius: 0.041,
      enabled: volume > 0.1,
    });
    updateOpeningTarget('standardFlask', {
      center: openingWorld,
      normal: new THREE.Vector3(0, 1, 0),
      radius: 0.0064,
      enabled: true,
    });
  });

  const fillScale = THREE.MathUtils.clamp(volume / 100, 0, 1);

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={START_POSITION}
      mass={0.22}
      linearDamping={2.4}
      angularDamping={10}
    >
      <BallCollider args={[0.044]} position={[0, -0.02, 0]} />
      <group
        onPointerDown={(event) => {
          event.stopPropagation();
          updatePointer(event);
          heldRef.current = true;
          setHeld(true);
          setHeldInstrument('volumetricFlask');
          log({ type: 'PICK', payload: { id: 'volumetricFlask' } });
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
          log({ type: 'DROP', payload: { id: 'volumetricFlask' } });
          gl.domElement.releasePointerCapture(event.pointerId);
        }}
      >
        <GlasswareModel url="/models/volumetric-flask-100ml.glb" />
        <mesh position={[0, -0.030, 0]} scale={[1, 0.78 + fillScale * 0.20, 1]} renderOrder={2}>
          <sphereGeometry args={[0.037, 48, 32]} />
          <meshPhysicalMaterial
            color="#ccecff"
            transmission={0.88}
            transparent
            opacity={0.48}
            roughness={0.06}
            ior={1.333}
            thickness={0.018}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0.075, 0.0095]}>
          <boxGeometry args={[0.018, 0.0008, 0.0007]} />
          <meshStandardMaterial color="#5f879b" roughness={0.42} />
        </mesh>
      </group>
    </RigidBody>
  );
}
