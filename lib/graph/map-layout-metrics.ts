/**
 * Layout geometry shared by TS layout code and CSS (.map-file-node, .map-group-label).
 */
export const MAP_TILE_WIDTH = 300;
export const MAP_TILE_HEIGHT = 144;

/** .map-group-label { top: -0.75rem } — label sits above the group box */
export const MAP_GROUP_LABEL_OVERHANG_PX = 12;

/** First group Y so the role label is not clipped at the top of the column */
export const MAP_COLUMN_TOP_INSET_PX = MAP_GROUP_LABEL_OVERHANG_PX;

export const MAP_GROUP_PAD_X = 20;
export const MAP_GROUP_PAD_Y = 18;
export const MAP_GROUP_PAD_BOTTOM = 14;

/** Stagger imports inside a group */
export const MAP_DEPTH_STEP_X = 0;

/** Base gaps at 100% spacing scale (user sliders multiply these) */
export const MAP_SPACING_BASE = {
  tileRowGap: 14,
  groupGapY: 22,
  roleColGap: 36,
} as const;
