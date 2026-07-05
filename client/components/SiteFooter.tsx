/**
 * Real site footer (brief §10.6 item 9): product links, company,
 * contact, legal — not a two-line minimal footer. Hidden on the editor
 * and simulator surfaces by ClientWrapper.
 */
import Link from "next/link";

const COLUMNS: { eyebrow: string; links: { label: string; href: string }[] }[] =
  [
    {
      eyebrow: "Product",
      links: [
        { label: "Projects", href: "/projects" },
        { label: "Lighting Simulator", href: "/simulator" },
        { label: "Pricing", href: "/#pricing" },
        { label: "Roadmap", href: "/#roadmap" },
      ],
    },
    {
      eyebrow: "Company",
      links: [
        { label: "About Solence", href: "/about" },
        { label: "Team Lanzones", href: "/about#team" },
        { label: "Contact", href: "/about#contact" },
      ],
    },
    {
      eyebrow: "Engineering",
      links: [
        { label: "How it works", href: "/#how-it-works" },
        { label: "Simulation scope", href: "/#scope" },
        { label: "PEC compliance", href: "/#features" },
      ],
    },
  ];

export default function SiteFooter() {
  return (
    <footer className="relative w-full border-t border-default-200 bg-content1/60 backdrop-blur-md">
      <div className="container mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <p className="font-display font-bold text-lg">Solence</p>
            <p className="text-xs text-default-500 mt-2 max-w-[24ch]">
              Automatic, PEC-aware electrical design for Philippine
              engineers.
            </p>
            <p className="font-mono text-[11px] uppercase tracking-widest text-default-400 mt-4">
              A Team Lanzones product
            </p>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.eyebrow}>
              <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-default-500 mb-3">
                {column.eyebrow}
              </p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      className="text-sm text-default-600 hover:text-primary transition-colors"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-4 border-t border-default-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-xs text-default-400">
            © {new Date().getFullYear()} Team Lanzones · MIT License
          </p>
          <p className="font-mono text-[11px] text-default-400">
            PEC figures pending licensed-EE verification — see any export’s
            PEC-VERIFY notice
          </p>
        </div>
      </div>
    </footer>
  );
}
