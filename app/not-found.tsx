import Link from "next/link";

export default function NotFound() {
  return (
    <main className="blueprint-grid min-h-screen flex flex-col items-center justify-center gap-4">
      <p
        className="text-6xl font-bold select-none"
        style={{ color: "var(--border-default)" }}
      >
        404
      </p>
      <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
        Page not found
      </h1>
      <p
        className="text-sm max-w-xs text-center"
        style={{ color: "var(--text-muted)" }}
      >
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="mt-4 btn-blueprint px-5 py-2.5">
        ← Back to CodeMap
      </Link>
    </main>
  );
}
