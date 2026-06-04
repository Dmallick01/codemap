/**
 * Single source of truth for map file tablet size and layout stride.
 * Layout positions, group bounds, and FileNode CSS must stay in sync.
 */
export const MAP_TILE_WIDTH = 300;
export const MAP_TILE_HEIGHT = 132;
/** Gap between stacked file rows inside a group */
export const MAP_TILE_ROW_GAP = 8;
export const MAP_TILE_ROW_STRIDE = MAP_TILE_HEIGHT + MAP_TILE_ROW_GAP;

export const MAP_GROUP_PAD_X = 16;
export const MAP_GROUP_PAD_Y = 14;
export const MAP_GROUP_PAD_BOTTOM = 10;
/** Vertical gap between folder groups in the same role column */
export const MAP_GROUP_GAP_Y = 12;
/** Horizontal gap between role columns (after tight column width) */
export const MAP_ROLE_COL_GAP = 20;

/** @deprecated Use per-role column packing in layout.ts */
export const MAP_ROLE_STEP_X = 300;
export const MAP_DEPTH_STEP_X = 24;

/** Height of a group containing `fileCount` file nodes */
export function groupHeightForFileCount(fileCount: number): number {
  if (fileCount <= 0) {
    return MAP_GROUP_PAD_Y + MAP_GROUP_PAD_BOTTOM;
  }
  return (
    MAP_GROUP_PAD_Y +
    fileCount * MAP_TILE_HEIGHT +
    (fileCount - 1) * MAP_TILE_ROW_GAP +
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

export const mapFileNodeStyle = {
  width: MAP_TILE_WIDTH,
  height: MAP_TILE_HEIGHT,
  zIndex: 1,
} as const;
