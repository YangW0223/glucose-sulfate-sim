import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Suspense, useEffect } from 'react';
import { ControlNesslerTube } from '../instruments/ControlNesslerTube';
import { ElectronicBalance } from '../instruments/ElectronicBalance';
import { GlucoseBottle } from '../instruments/GlucoseBottle';
import { GraduatedPipette } from '../instruments/GraduatedPipette';
import { GraduatedCylinder } from '../instruments/GraduatedCylinder';
import { NesslerTube } from '../instruments/NesslerTube';
import { PipetteBulb } from '../instruments/PipetteBulb';
import { PowderSpills } from '../instruments/PowderSpills';
import { Spatula } from '../instruments/Spatula';
import { SpillPuddles } from '../instruments/SpillPuddles';
import { WeighingPaper } from '../instruments/WeighingPaper';
import { VolumetricFlask } from '../instruments/VolumetricFlask';
import { WashBottle } from '../instruments/WashBottle';
import { useSimulationStore } from '../store/useSimulationStore';
import { InstrumentShelf } from './InstrumentShelf';
import { LAB_PALETTE } from './labPalette';
import { Workbench } from './Workbench';
import { WorkbenchDropZone } from './WorkbenchDropZone';

export function LabScene() {
  const targetVolumeMl = useSimulationStore((s) => s.targetVolumeMl);
  const heldInstrumentId = useSimulationStore((s) => s.heldInstrumentId);

  useEffect(() => {
    if (heldInstrumentId) document.body.style.cursor = 'grabbing';
    return () => { if (heldInstrumentId) document.body.style.cursor = 'default'; };
  }, [heldInstrumentId]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0.62, 1.36, 0.92]} fov={38} />
      <ambientLight intensity={0.46} />
      <hemisphereLight args={[LAB_PALETTE.lighting.hemisphereSky, LAB_PALETTE.lighting.hemisphereGround, 0.68]} />
      <directionalLight
        position={[1.8, 3.2, 2.1]}
        intensity={1.72}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00008}
        shadow-normalBias={0.025}
        shadow-camera-near={0.25}
        shadow-camera-far={7}
      />
      <directionalLight position={[-0.25, 2.05, 1.55]} intensity={0.82} />
      <directionalLight position={[-1.4, 2.0, -1.2]} intensity={0.34} />

      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.85} />
        <Physics gravity={[0, -9.81, 0]} timeStep="vary">
          <Workbench />
          <WorkbenchDropZone />
          <InstrumentShelf />
          <ElectronicBalance />
          <GlucoseBottle />
          <WeighingPaper />
          <Spatula />
          <NesslerTube volumeMl={targetVolumeMl} />
          <ControlNesslerTube />
          <VolumetricFlask />
          <GraduatedPipette />
          <PipetteBulb />
          <GraduatedCylinder />
          <WashBottle />
          <SpillPuddles />
          <PowderSpills />
        </Physics>
      </Suspense>
      <OrbitControls
        makeDefault
        enabled={!heldInstrumentId}
        target={[0, 1.09, -0.04]}
        minDistance={0.48}
        maxDistance={1.85}
        minPolarAngle={0.72}
        maxPolarAngle={1.42}
        minAzimuthAngle={-0.98}
        maxAzimuthAngle={0.98}
        enablePan={false}
      />
    </>
  );
}
