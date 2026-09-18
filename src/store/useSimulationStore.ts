import { create } from 'zustand';
import type {
  ActiveOperation,
  InstrumentId,
  PipetteOperation,
  PowderOperation,
  SimulationEvent,
  SpillRecord,
  PowderSpillRecord,
  StreamDestination,
  LiquidKind,
} from '../types/simulation';

export const WEIGHING_PAPER_MASS_G = 0.684;
export const INITIAL_GLUCOSE_BOTTLE_MASS_G = 50;
export const INITIAL_STANDARD_FLASK_VOLUME_ML = 100;

interface SimulationStore {
  washBottleVolumeMl: number;
  sourceVolumeMl: number;
  targetVolumeMl: number;
  controlTubeVolumeMl: number;
  spilledVolumeMl: number;
  standardSpilledVolumeMl: number;
  pourRateMlPerSec: number;
  tiltDeg: number;
  squeezePressure: number;
  streamDestination: StreamDestination;
  activeOperation: ActiveOperation;

  standardFlaskVolumeMl: number;
  pipetteVolumeMl: number;
  controlStandardVolumeMl: number;
  pipetteBulbAttached: boolean;
  pipetteSuction01: number;
  pipetteDispense01: number;
  pipetteFlowRateMlPerSec: number;
  pipetteOperation: PipetteOperation;

  glucoseBottleMassG: number;
  spatulaPowderMassG: number;
  paperGlucoseMassG: number;
  tubeGlucoseMassG: number;
  powderSpilledMassG: number;
  balanceTareG: number;
  balanceReadingG: number;
  paperOnBalance: boolean;
  powderRateGPerSec: number;
  powderOperation: PowderOperation;

  heldInstrumentId: InstrumentId | null;
  spillRecords: SpillRecord[];
  powderSpillRecords: PowderSpillRecord[];
  events: SimulationEvent[];
  resetVersion: number;

  setHeldInstrument: (id: InstrumentId | null) => void;
  setWashBottleVolume: (value: number) => void;
  setSourceVolume: (value: number) => void;
  setTargetVolume: (value: number) => void;
  setControlTubeVolume: (value: number) => void;
  recordSpill: (input: { volumeMl: number; position: [number, number, number]; liquid?: LiquidKind }) => void;
  setTelemetry: (input: {
    rate: number;
    tiltDeg?: number;
    squeezePressure?: number;
    destination: StreamDestination;
    operation: ActiveOperation;
  }) => void;

  setStandardFlaskVolume: (value: number) => void;
  setPipetteVolume: (value: number) => void;
  setControlStandardVolume: (value: number) => void;
  setPipetteBulbAttached: (value: boolean) => void;
  setPipetteTelemetry: (input: {
    suction01?: number;
    dispense01?: number;
    rate?: number;
    operation: PipetteOperation;
  }) => void;

  setGlucoseBottleMass: (value: number) => void;
  setSpatulaPowderMass: (value: number) => void;
  setPaperGlucoseMass: (value: number) => void;
  setTubeGlucoseMass: (value: number) => void;
  recordPowderSpill: (input: { massG: number; position: [number, number, number] }) => void;
  setPaperOnBalance: (value: boolean) => void;
  setBalanceReading: (value: number) => void;
  tareBalance: (grossMassG: number) => void;
  setPowderTelemetry: (input: { rate: number; operation: PowderOperation }) => void;

  log: (event: Omit<SimulationEvent, 'id' | 'createdAt'>) => void;
  reset: () => void;
}

const initialState = {
  washBottleVolumeMl: 180,
  sourceVolumeMl: 0,
  targetVolumeMl: 0,
  controlTubeVolumeMl: 0,
  spilledVolumeMl: 0,
  standardSpilledVolumeMl: 0,
  pourRateMlPerSec: 0,
  tiltDeg: 0,
  squeezePressure: 0,
  streamDestination: 'none' as const,
  activeOperation: 'none' as const,

  standardFlaskVolumeMl: INITIAL_STANDARD_FLASK_VOLUME_ML,
  pipetteVolumeMl: 0,
  controlStandardVolumeMl: 0,
  pipetteBulbAttached: false,
  pipetteSuction01: 0,
  pipetteDispense01: 0,
  pipetteFlowRateMlPerSec: 0,
  pipetteOperation: 'none' as const,

  glucoseBottleMassG: INITIAL_GLUCOSE_BOTTLE_MASS_G,
  spatulaPowderMassG: 0,
  paperGlucoseMassG: 0,
  tubeGlucoseMassG: 0,
  powderSpilledMassG: 0,
  balanceTareG: 0,
  balanceReadingG: 0,
  paperOnBalance: false,
  powderRateGPerSec: 0,
  powderOperation: 'none' as const,

  heldInstrumentId: null as InstrumentId | null,
};

const nearlyEqual = (a: number, b: number, epsilon: number) => Math.abs(a - b) <= epsilon;

export const useSimulationStore = create<SimulationStore>((set) => ({
  ...initialState,
  spillRecords: [],
  powderSpillRecords: [],
  events: [],
  resetVersion: 0,

  setHeldInstrument: (id) =>
    set((state) => (state.heldInstrumentId === id ? state : { heldInstrumentId: id })),

  setWashBottleVolume: (value) =>
    set((state) => {
      const next = Math.max(0, Math.min(250, value));
      return nearlyEqual(state.washBottleVolumeMl, next, 0.0001) ? state : { washBottleVolumeMl: next };
    }),
  setSourceVolume: (value) =>
    set((state) => {
      const next = Math.max(0, Math.min(50, value));
      return nearlyEqual(state.sourceVolumeMl, next, 0.0001) ? state : { sourceVolumeMl: next };
    }),
  setTargetVolume: (value) =>
    set((state) => {
      const next = Math.max(0, Math.min(50, value));
      return nearlyEqual(state.targetVolumeMl, next, 0.0001) ? state : { targetVolumeMl: next };
    }),
  setControlTubeVolume: (value) =>
    set((state) => {
      const next = Math.max(0, Math.min(50, value));
      return nearlyEqual(state.controlTubeVolumeMl, next, 0.0001) ? state : { controlTubeVolumeMl: next };
    }),

  recordSpill: ({ volumeMl, position, liquid = 'water' }) => {
    const amount = Math.max(0, volumeMl);
    if (amount <= 0) return;
    set((state) => {
      const records = [...state.spillRecords];
      let nearestIndex = -1;
      let nearestD2 = 0.03 * 0.03;
      for (let i = 0; i < records.length; i += 1) {
        if (records[i].liquid !== liquid) continue;
        const dx = records[i].position[0] - position[0];
        const dz = records[i].position[2] - position[2];
        const d2 = dx * dx + dz * dz;
        if (d2 < nearestD2) {
          nearestD2 = d2;
          nearestIndex = i;
        }
      }
      if (nearestIndex >= 0) {
        const current = records[nearestIndex];
        records[nearestIndex] = {
          ...current,
          volumeMl: current.volumeMl + amount,
          position: [
            (current.position[0] * current.volumeMl + position[0] * amount) / (current.volumeMl + amount),
            position[1],
            (current.position[2] * current.volumeMl + position[2] * amount) / (current.volumeMl + amount),
          ],
        };
      } else {
        records.push({
          id: `spill-${performance.now()}-${state.spillRecords.length}`,
          liquid,
          volumeMl: amount,
          position,
          createdAt: Date.now(),
        });
      }
      return {
        spilledVolumeMl: state.spilledVolumeMl + (liquid === 'water' ? amount : 0),
        standardSpilledVolumeMl: state.standardSpilledVolumeMl + (liquid === 'standardSulfate' ? amount : 0),
        spillRecords: records.slice(-30),
      };
    });
  },

  setTelemetry: ({ rate, tiltDeg, squeezePressure, destination, operation }) =>
    set((state) => {
      const nextTilt = tiltDeg ?? state.tiltDeg;
      const nextPressure = squeezePressure ?? state.squeezePressure;
      if (
        nearlyEqual(state.pourRateMlPerSec, rate, 0.05) &&
        nearlyEqual(state.tiltDeg, nextTilt, 0.1) &&
        nearlyEqual(state.squeezePressure, nextPressure, 0.01) &&
        state.streamDestination === destination &&
        state.activeOperation === operation
      ) {
        return state;
      }
      return {
        pourRateMlPerSec: rate,
        tiltDeg: nextTilt,
        squeezePressure: nextPressure,
        streamDestination: destination,
        activeOperation: operation,
      };
    }),

  setStandardFlaskVolume: (value) =>
    set((state) => {
      const next = Math.max(0, Math.min(100, value));
      return nearlyEqual(state.standardFlaskVolumeMl, next, 0.0001) ? state : { standardFlaskVolumeMl: next };
    }),
  setPipetteVolume: (value) =>
    set((state) => {
      const next = Math.max(0, Math.min(5, value));
      return nearlyEqual(state.pipetteVolumeMl, next, 0.0001) ? state : { pipetteVolumeMl: next };
    }),
  setControlStandardVolume: (value) =>
    set((state) => {
      const next = Math.max(0, value);
      return nearlyEqual(state.controlStandardVolumeMl, next, 0.0001) ? state : { controlStandardVolumeMl: next };
    }),
  setPipetteBulbAttached: (value) =>
    set((state) => (state.pipetteBulbAttached === value ? state : { pipetteBulbAttached: value })),

  setPipetteTelemetry: ({ suction01, dispense01, rate, operation }) =>
    set((state) => {
      const nextSuction = suction01 ?? state.pipetteSuction01;
      const nextDispense = dispense01 ?? state.pipetteDispense01;
      const nextRate = rate ?? state.pipetteFlowRateMlPerSec;
      if (
        nearlyEqual(state.pipetteSuction01, nextSuction, 0.01) &&
        nearlyEqual(state.pipetteDispense01, nextDispense, 0.01) &&
        nearlyEqual(state.pipetteFlowRateMlPerSec, nextRate, 0.03) &&
        state.pipetteOperation === operation
      ) {
        return state;
      }
      return {
        pipetteSuction01: nextSuction,
        pipetteDispense01: nextDispense,
        pipetteFlowRateMlPerSec: nextRate,
        pipetteOperation: operation,
      };
    }),

  setGlucoseBottleMass: (value) =>
    set((state) => {
      const next = Math.max(0, value);
      return nearlyEqual(state.glucoseBottleMassG, next, 0.00001) ? state : { glucoseBottleMassG: next };
    }),
  setSpatulaPowderMass: (value) =>
    set((state) => {
      const next = Math.max(0, Math.min(1.2, value));
      return nearlyEqual(state.spatulaPowderMassG, next, 0.00001) ? state : { spatulaPowderMassG: next };
    }),
  setPaperGlucoseMass: (value) =>
    set((state) => {
      const next = Math.max(0, value);
      return nearlyEqual(state.paperGlucoseMassG, next, 0.00001) ? state : { paperGlucoseMassG: next };
    }),
  setTubeGlucoseMass: (value) =>
    set((state) => {
      const next = Math.max(0, value);
      return nearlyEqual(state.tubeGlucoseMassG, next, 0.00001) ? state : { tubeGlucoseMassG: next };
    }),

  recordPowderSpill: ({ massG, position }) => {
    const amount = Math.max(0, massG);
    if (amount <= 0) return;
    set((state) => {
      const records = [...state.powderSpillRecords];
      let nearestIndex = -1;
      let nearestD2 = 0.025 * 0.025;
      for (let i = 0; i < records.length; i += 1) {
        const dx = records[i].position[0] - position[0];
        const dz = records[i].position[2] - position[2];
        const d2 = dx * dx + dz * dz;
        if (d2 < nearestD2) {
          nearestD2 = d2;
          nearestIndex = i;
        }
      }
      if (nearestIndex >= 0) {
        const current = records[nearestIndex];
        records[nearestIndex] = {
          ...current,
          massG: current.massG + amount,
          position: [
            (current.position[0] * current.massG + position[0] * amount) / (current.massG + amount),
            position[1],
            (current.position[2] * current.massG + position[2] * amount) / (current.massG + amount),
          ],
        };
      } else {
        records.push({
          id: `powder-spill-${performance.now()}-${state.powderSpillRecords.length}`,
          massG: amount,
          position,
          createdAt: Date.now(),
        });
      }
      return {
        powderSpilledMassG: state.powderSpilledMassG + amount,
        powderSpillRecords: records.slice(-24),
      };
    });
  },

  setPaperOnBalance: (value) =>
    set((state) => (state.paperOnBalance === value ? state : { paperOnBalance: value })),

  setBalanceReading: (value) =>
    set((state) =>
      nearlyEqual(state.balanceReadingG, value, 0.0005)
        ? state
        : { balanceReadingG: value },
    ),

  tareBalance: (grossMassG) => {
    set({ balanceTareG: grossMassG });
    set((state) => ({
      events: [
        ...state.events,
        {
          id: `TARE-${performance.now()}-${state.events.length}`,
          type: 'TARE',
          createdAt: Date.now(),
          payload: { grossMassG },
        },
      ].slice(-160),
    }));
  },

  setPowderTelemetry: ({ rate, operation }) =>
    set((state) => {
      if (
        nearlyEqual(state.powderRateGPerSec, rate, 0.002) &&
        state.powderOperation === operation
      ) {
        return state;
      }
      return { powderRateGPerSec: rate, powderOperation: operation };
    }),

  log: (event) =>
    set((state) => ({
      events: [
        ...state.events,
        {
          ...event,
          id: `${event.type}-${performance.now()}-${state.events.length}`,
          createdAt: Date.now(),
        },
      ].slice(-160),
    })),

  reset: () =>
    set((state) => ({
      ...initialState,
      spillRecords: [],
      powderSpillRecords: [],
      events: [
        {
          id: `RESET-${performance.now()}`,
          type: 'RESET',
          createdAt: Date.now(),
          payload: {},
        },
      ],
      resetVersion: state.resetVersion + 1,
    })),
}));
