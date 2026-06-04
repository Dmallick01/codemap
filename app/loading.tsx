export default function Loading() {
  return (
    <div className="blueprint-grid min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-4"
          style={{
            borderColor: "var(--accent-dim)",
            borderTopColor: "var(--accent)",
          }}
        />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading…
        </p>
      </div>
    </div>
  );
}
