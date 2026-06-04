"use client";

type Props = {
  index: number;
  total: number;
  viewedCount: number;
  currentPath: string;
  onPrev: () => void;
  onNext: () => void;
  onRandom: () => void;
  showHelp: boolean;
  onToggleHelp: () => void;
};

export default function ExplorerToolbar({
  index,
  total,
  viewedCount,
  currentPath,
  onPrev,
  onNext,
  onRandom,
  showHelp,
  onToggleHelp,
}: Props) {
  if (total === 0) return null;

  return (
    <div className="flex-none border-t border-gray-800 bg-gray-950/95 backdrop-blur z-30">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={index <= 0}
          className="px-2.5 py-1 text-[11px] rounded border border-gray-700 text-gray-300 hover:border-gray-500 disabled:opacity-40"
          title="Previous (P)"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={index >= total - 1}
          className="px-2.5 py-1 text-[11px] rounded border border-gray-700 text-gray-300 hover:border-gray-500 disabled:opacity-40"
          title="Next (N)"
        >
          Next →
        </button>
        <button
          type="button"
          onClick={onRandom}
          className="px-2.5 py-1 text-[11px] rounded border border-gray-700 text-gray-400 hover:text-gray-200"
          title="Random (R)"
        >
          Random
        </button>

        <span className="text-[11px] text-violet-400/80 font-medium ml-1">
          Tour
        </span>
        <span className="text-[11px] text-gray-500 font-mono">
          {index + 1} / {total}
        </span>
        <span className="text-[11px] text-emerald-500/80">
          {viewedCount} viewed
        </span>
        <span
          className="text-[11px] text-gray-400 truncate max-w-[min(40ch,50vw)] font-mono"
          title={currentPath}
        >
          {currentPath}
        </span>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onToggleHelp}
          className="text-[11px] px-2 py-1 rounded border border-gray-700 text-gray-500 hover:text-gray-200"
        >
          {showHelp ? "Hide shortcuts" : "? Shortcuts"}
        </button>
      </div>

      {showHelp && (
        <div className="px-4 pb-3 text-[10px] text-gray-500 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 border-t border-gray-800/80 pt-2">
          <span>
            <kbd className="text-gray-300">N</kbd> / <kbd className="text-gray-300">→</kbd>{" "}
            Next file
          </span>
          <span>
            <kbd className="text-gray-300">P</kbd> / <kbd className="text-gray-300">←</kbd>{" "}
            Previous
          </span>
          <span>
            <kbd className="text-gray-300">R</kbd> Random file
          </span>
          <span>
            <kbd className="text-gray-300">Esc</kbd> Close panel
          </span>
          <span className="col-span-2 sm:col-span-4 text-gray-600">
            HF Viewer–style: one anchor file at a time, with connections on the
            map. Progress auto-saves — resume by reopening this repo.
          </span>
        </div>
      )}
    </div>
  );
}
