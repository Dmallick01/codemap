/**
 * Map node dimensions for React Flow — must match .map-file-node in globals.css.
 */
import {
  MAP_TILE_HEIGHT,
  MAP_TILE_WIDTH,
  MAP_SPACING_BASE,
  MAP_GROUP_LABEL_OVERHANG_PX,
  MAP_COLUMN_TOP_INSET_PX,
  MAP_GROUP_PAD_X,
  MAP_GROUP_PAD_Y,
  MAP_GROUP_PAD_BOTTOM,
  MAP_DEPTH_STEP_X,
} from "./map-layout-metrics";

export {
  MAP_TILE_WIDTH,
  MAP_TILE_HEIGHT,
  MAP_GROUP_LABEL_OVERHANG_PX,
  MAP_COLUMN_TOP_INSET_PX,
  MAP_GROUP_PAD_X,
  MAP_GROUP_PAD_Y,
  MAP_GROUP_PAD_BOTTOM,
  MAP_DEPTH_STEP_X,
  MAP_SPACING_BASE,
} from "./map-layout-metrics";

export const MAP_TILE_ROW_GAP = MAP_SPACING_BASE.tileRowGap;
export const MAP_TILE_ROW_STRIDE = MAP_TILE_HEIGHT + MAP_TILE_ROW_GAP;
export const MAP_GROUP_GAP_Y = MAP_SPACING_BASE.groupGapY;
export const MAP_ROLE_COL_GAP = MAP_SPACING_BASE.roleColGap;

/** @deprecated Use per-role column packing in layout.ts */
export const MAP_ROLE_STEP_X = 300;

export const mapFileNodeStyle = {
  width: MAP_TILE_WIDTH,
  height: MAP_TILE_HEIGHT,
  zIndex: 1,
} as const;
