import Link from "next/link";

/** 404 — same instrument-panel voice as everything else (brief §10.5). */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="font-mono text-[11px] uppercase tracking-widest text-brand-amber-dark dark:text-brand-amber">
        Signal lost
      </p>
      <h1 className="font-display font-bold text-6xl tracking-tight mt-3">
        404
      </h1>
      <p className="text-default-500 mt-3 max-w-sm text-sm">
        This route isn&apos;t on the panel directory. Check the address, or head
        back to your projects.
      </p>
      <Link
        className="mt-8 bg-brand-teal-dark hover:bg-brand-teal transition-colors px-6 py-2.5 rounded-control text-white font-medium"
        href="/projects"
      >
        Back to projects
      </Link>
    </div>
  );
}
