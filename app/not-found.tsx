import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col items-center justify-center gap-4">
      <p className="text-6xl font-bold text-gray-800 select-none">404</p>
      <h1 className="text-xl font-semibold text-gray-300">Page not found</h1>
      <p className="text-sm text-gray-600 max-w-xs text-center">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-4 rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
      >
        ← Back to CodeMap
      </Link>
    </main>
  );
}
