// config/site.ts

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Solence",
  description:
    "Draw a floor plan. Get a complete, code-compliant wiring design — automatically.",
  navItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Projects",
      href: "/projects",
    },
    {
      label: "About",
      href: "/about",
    },
  ],
  navMenuItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Projects",
      href: "/projects",
    },
    {
      label: "About",
      href: "/about",
    },
  ],
  // Enhanced lamp types with luminous flux values
};
