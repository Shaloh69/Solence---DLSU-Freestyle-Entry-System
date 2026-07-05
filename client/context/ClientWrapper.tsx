"use client";

import { usePathname } from "next/navigation";
import clsx from "clsx";

import SiteFooter from "@/components/SiteFooter";

/**
 * Route-aware page shell: full-bleed for work surfaces (simulator,
 * editor), contained for everything else. The real footer renders on
 * marketing/dashboard pages only — never under the editor.
 */
export default function ClientWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isWorkSurface =
    pathname.startsWith("/sim") ||
    pathname.startsWith("/simulator") ||
    /^\/projects\/[^/]+\/editor/.test(pathname);

  return (
    <>
      <main
        className={clsx(
          "pt-16 flex-grow bg-transparent relative",
          isWorkSurface ? "flex w-full" : "container mx-auto max-w-7xl px-6"
        )}
      >
        {children}
      </main>

      {!isWorkSurface && <SiteFooter />}
    </>
  );
}
