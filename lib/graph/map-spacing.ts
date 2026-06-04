import {
  MAP_GROUP_PAD_BOTTOM,
  MAP_GROUP_PAD_X,
  MAP_GROUP_PAD_Y,
  MAP_DEPTH_STEP_X,
  MAP_SPACING_BASE,
  MAP_TILE_HEIGHT,
  MAP_TILE_WIDTH,
} from "./map-layout-metrics";

export { MAP_SPACING_BASE } from "./map-layout-metrics";

export type MapSpacingScale = {
  /** File rows inside a folder group */
  row: number;
  /** Folder groups stacked in a role column */
  group: number;
  /** Role columns left–right */
  column: number;
};

export const DEFAULT_MAP_SPACING_SCALE: MapSpacingScale = {
  row: 1,
  group: 1,
  column: 1,
};

export const MAP_SPACING_SCALE_MIN = 0.5;
export const MAP_SPACING_SCALE_MAX = 2;
export const MAP_SPACING_SCALE_STEP = 0.05;

export type ResolvedMapSpacing = {
  tileRowGap: number;
  groupGapY: number;
  roleColGap: number;
};

export function resolveMapSpacing(scale: MapSpacingScale): ResolvedMapSpacing {
  return {
    tileRowGap: Math.round(MAP_SPACING_BASE.tileRowGap * scale.row),
    groupGapY: Math.round(MAP_SPACING_BASE.groupGapY * scale.group),
    roleColGap: Math.round(MAP_SPACING_BASE.roleColGap * scale.column),
  };
}

export function tileRowStride(spacing: ResolvedMapSpacing): number {
  return MAP_TILE_HEIGHT + spacing.tileRowGap;
}

export function groupHeightForFileCount(
  fileCount: number,
  spacing: ResolvedMapSpacing,
): number {
  if (fileCount <= 0) {
    return MAP_GROUP_PAD_Y + MAP_GROUP_PAD_BOTTOM;
  }
  return (
    MAP_GROUP_PAD_Y +
    fileCount * MAP_TILE_HEIGHT +
    (fileCount - 1) * spacing.tileRowGap +
    MAP_GROUP_PAD_BOTTOM
  );
}

export function groupWidthForDepth(maxDepthInBucket: number): number {
  return (
    MAP_GROUP_PAD_X * 2 +
    MAP_TILE_WIDTH +
    maxDepthInBucket * MAP_DEPTH_STEP_X
  );
}

export function clampSpacingScale(value: number): number {
  return Math.min(
    MAP_SPACING_SCALE_MAX,
    Math.max(MAP_SPACING_SCALE_MIN, value),
  );
}

export function clampSpacingScaleState(scale: MapSpacingScale): MapSpacingScale {
  return {
    row: clampSpacingScale(scale.row),
    group: clampSpacingScale(scale.group),
    column: clampSpacingScale(scale.column),
  };
}
