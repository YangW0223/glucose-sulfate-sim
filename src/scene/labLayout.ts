export const LAB_LAYOUT = {
  tableTopY: 0.85,
  shelf: {
    centerZ: -0.49,
    width: 1.82,
    depth: 0.34,
    lowerShelfTopY: 1.10,
    upperShelfTopY: 1.43,
  },
} as const;

export const INSTRUMENT_HOME = {
  washBottle: [-0.70, 1.182, -0.348] as [number, number, number],
  volumetricFlask: [-0.31, 1.177, -0.348] as [number, number, number],
  graduatedCylinder50: [0.10, 1.180, -0.348] as [number, number, number],
  glucoseBottle: [0.52, 1.155, -0.348] as [number, number, number],
  testTube: [-0.72, 1.519, -0.348] as [number, number, number],
  controlTube: [-0.52, 1.519, -0.348] as [number, number, number],
  graduatedPipette5: [-0.25, 1.587, -0.348] as [number, number, number],
  pipetteBulb: [0.04, 1.461, -0.348] as [number, number, number],
  spatula: [0.36, 1.437, -0.348] as [number, number, number],
  weighingPaper: [0.70, 1.434, -0.348] as [number, number, number],
} as const;
