import { cylinderCapacityMl } from '../engine/liquidSurface';

export const CYLINDER_50 = {
  innerRadiusM: 0.0115,
  cavityBottomY: -0.069,
  cavityTopY: 0.078,
  bodyTopY: 0.083,
  outerRadiusM: 0.0132,
  baseBottomY: -0.080,
  mark50Y: 0.051,
} as const;

export const CYLINDER_50_CAVITY_HEIGHT = CYLINDER_50.cavityTopY - CYLINDER_50.cavityBottomY;
export const CYLINDER_50_CAVITY_CENTER_Y = (CYLINDER_50.cavityTopY + CYLINDER_50.cavityBottomY) / 2;
export const CYLINDER_50_PHYSICAL_CAPACITY_ML = cylinderCapacityMl(
  CYLINDER_50.innerRadiusM,
  CYLINDER_50_CAVITY_HEIGHT,
);

export const NESSLER_50 = {
  innerRadiusM: 0.011,
  cavityBottomY: -0.081,
  cavityTopY: 0.101,
  bodyTopY: 0.105,
  outerRadiusM: 0.0125,
  baseBottomY: -0.090,
  mark25Y: -0.014,
  mark50Y: 0.052,
} as const;

export const NESSLER_50_CAVITY_HEIGHT = NESSLER_50.cavityTopY - NESSLER_50.cavityBottomY;
export const NESSLER_50_CAVITY_CENTER_Y = (NESSLER_50.cavityTopY + NESSLER_50.cavityBottomY) / 2;
export const NESSLER_50_PHYSICAL_CAPACITY_ML = cylinderCapacityMl(
  NESSLER_50.innerRadiusM,
  NESSLER_50_CAVITY_HEIGHT,
);
