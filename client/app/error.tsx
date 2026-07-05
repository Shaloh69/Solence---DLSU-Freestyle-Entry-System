"use client";

import { useEffect } from "react";

/** Route error boundary — specific, recoverable, on-voice (brief §10.5). */
export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    /* eslint-disable no-console */
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="font-mono text-[11px] uppercase tracking-widest text-danger">
        Fault detected
      </p>
      <h1 className="font-display font-bold text-3xl tracking-tight mt-3">
        This page tripped
      </h1>
      <p className="text-default-500 mt-3 max-w-md text-sm">
        {error.message || "An unexpected error interrupted rendering."} Your
        project data is stored server-side and is not affected.
      </p>
      <button
        className="mt-8 bg-brand-teal-dark hover:bg-brand-teal transition-colors px-6 py-2.5 rounded-control text-white font-medium"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
