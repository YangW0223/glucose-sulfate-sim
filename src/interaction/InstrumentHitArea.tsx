interface InstrumentHitAreaProps {
  size: [number, number, number];
  position?: [number, number, number];
}

/**
 * Invisible but raycastable interaction volume.
 *
 * Thin transparent glass, pipettes, spatulas and weighing paper are difficult
 * to click reliably if pointer picking depends only on their visible triangles.
 * This mesh does not change physics; it only gives pointer events a forgiving
 * target. Events bubble to the parent instrument group.
 */
export function InstrumentHitArea({
  size,
  position = [0, 0, 0],
}: InstrumentHitAreaProps) {
  return (
    <mesh position={position} frustumCulled={false} renderOrder={-1}>
      <boxGeometry args={size} />
      <meshBasicMaterial
        transparent
        opacity={0.001}
        depthWrite={false}
        colorWrite={false}
      />
    </mesh>
  );
}
