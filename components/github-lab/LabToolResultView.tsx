"use client";

import type { LabToolResult } from "@/lib/services/github-lab";

export default function LabToolResultView({ result }: { result: LabToolResult }) {
  if (!result.ok) {
    return (
      <div
        className="lab-result-error p-4 rounded-md text-sm"
        style={{ borderColor: "rgba(248, 113, 113, 0.4)" }}
      >
        <p className="font-medium" style={{ color: "#f87171" }}>
          {result.error ?? "Tool failed"}
        </p>
      </div>
    );
  }

  return (
    <div className="lab-result space-y-4 animate-lab-in">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {result.title}
        </h3>
        {result.summary && (
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {result.summary}
          </p>
        )}
      </div>

      {result.metrics && result.metrics.length > 0 && (
        <div className="metric-grid">
          {result.metrics.map((m) => (
            <div key={m.label} className="metric-cell">
              <span className="metric-label">{m.label}</span>
              <span className="metric-value">{String(m.value)}</span>
            </div>
          ))}
        </div>
      )}

      {result.rows && result.rows.length > 0 && (
        <div className="lab-table-wrap">
          <table className="lab-table">
            <thead>
              <tr>
                {Object.keys(result.rows[0]).map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((v, j) => (
                    <td key={j}>{v == null ? "—" : String(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.text && (
        <pre
          className="lab-pre text-[10px] leading-relaxed p-3 rounded-md overflow-auto max-h-48"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-mono)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {result.text}
        </pre>
      )}
    </div>
  );
}
