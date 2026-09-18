export type InstrumentId =
  | 'washBottle'
  | 'cylinder50'
  | 'testTube'
  | 'controlTube'
  | 'spatula'
  | 'weighingPaper'
  | 'volumetricFlask'
  | 'pipette5'
  | 'pipetteBulb'
  | 'glucoseBottle';

export type LiquidKind = 'water' | 'standardSulfate';

export interface LiquidState {
  volumeMl: number;
  capacityMl: number;
  turbidity: number;
}

export interface InstrumentPose {
  position: [number, number, number];
  rotation: [number, number, number];
}

export interface InstrumentState {
  id: InstrumentId;
  pose: InstrumentPose;
  liquid: LiquidState;
  held: boolean;
}

export interface SpillRecord {
  id: string;
  liquid: LiquidKind;
  volumeMl: number;
  position: [number, number, number];
  createdAt: number;
}

export interface PowderSpillRecord {
  id: string;
  massG: number;
  position: [number, number, number];
  createdAt: number;
}

export type StreamDestination = 'wash-bottle' | 'cylinder' | 'tube' | 'control-tube' | 'bench' | 'none';
export type ActiveOperation =
  | 'wash-to-cylinder'
  | 'cylinder-to-tube'
  | 'cylinder-to-control'
  | 'pipette-aspirate'
  | 'pipette-to-control'
  | 'none';
export type PowderOperation = 'scoop' | 'spatula-to-paper' | 'paper-to-tube' | 'none';
export type PipetteOperation = 'attach-bulb' | 'aspirate' | 'dispense' | 'none';

export interface SimulationEvent {
  id: string;
  type:
    | 'PICK'
    | 'DROP'
    | 'SQUEEZE_START'
    | 'SQUEEZE_END'
    | 'TRANSFER'
    | 'SPILL'
    | 'TARE'
    | 'SCOOP'
    | 'POWDER_TRANSFER'
    | 'ATTACH'
    | 'ASPIRATE'
    | 'DISPENSE'
    | 'RESET';
  createdAt: number;
  payload: Record<string, unknown>;
}
