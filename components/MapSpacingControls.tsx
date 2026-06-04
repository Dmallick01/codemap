"use client";

import { useState } from "react";
import {
  DEFAULT_MAP_SPACING_SCALE,
  MAP_SPACING_SCALE_MAX,
  MAP_SPACING_SCALE_MIN,
  MAP_SPACING_SCALE_STEP,
  type MapSpacingScale,
} from "@/lib/graph/map-spacing";

type Props = {
  scale: MapSpacingScale;
  onChange: (patch: Partial<MapSpacingScale>) => void;
  onReset: () => void;
  className?: string;
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function SliderRow({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
        <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--accent)" }}>
          {pct(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={MAP_SPACING_SCALE_MIN}
        max={MAP_SPACING_SCALE_MAX}
        step={MAP_SPACING_SCALE_STEP}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="map-spacing-slider w-full"
        aria-valuetext={pct(value)}
      />
      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        {hint}
      </p>
    </label>
  );
}

export default function MapSpacingControls({
  scale,
  onChange,
  onReset,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);

  const isDefault =
    scale.row === DEFAULT_MAP_SPACING_SCALE.row &&
    scale.group === DEFAULT_MAP_SPACING_SCALE.group &&
    scale.column === DEFAULT_MAP_SPACING_SCALE.column;

  return (
    <div className={`pointer-events-auto ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`btn-blueprint text-[12px] ${open ? "nav-tab-active" : ""}`}
        title="Adjust map row and column spacing"
        aria-expanded={open}
      >
        Spacing {open ? "▾" : "▸"}
      </button>

      {open && (
        <div
          className="panel-blueprint mt-2 p-3 w-[min(260px,85vw)] space-y-3"
          role="region"
          aria-label="Map spacing"
        >
          <SliderRow
            id="map-spacing-row"
            label="Rows"
            hint="Space between files in a folder"
            value={scale.row}
            onChange={(row) => onChange({ row })}
          />
          <SliderRow
            id="map-spacing-group"
            label="Stacks"
            hint="Space between folder groups"
            value={scale.group}
            onChange={(group) => onChange({ group })}
          />
          <SliderRow
            id="map-spacing-column"
            label="Columns"
            hint="Space between architecture roles"
            value={scale.column}
            onChange={(column) => onChange({ column })}
          />
          <button
            type="button"
            onClick={onReset}
            disabled={isDefault}
            className="btn-blueprint w-full text-[11px] disabled:opacity-40"
          >
            Reset spacing
          </button>
        </div>
      )}
    </div>
  );
}
