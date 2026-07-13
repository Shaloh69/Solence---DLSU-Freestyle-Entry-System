"use client";

/**
 * Navbar with the restrained motion system from DESIGN.md §4 /
 * brief §10.8: scroll-reactive surface (transparent over the hero →
 * blurred solid after), hide-on-scroll-down / reveal-on-scroll-up,
 * sliding link indicator, instrument-glow logo hover, staggered mobile
 * drawer, and a persistently highlighted CTA. Reduced-motion users get
 * the static version (globals.css gates every effect).
 */
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import { Link } from "@heroui/link";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { Logo } from "@/components/icons";

export const Navbar = () => {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <HeroUINavbar
      shouldHideOnScroll
      classNames={{
        base: clsx(
          "transition-colors duration-300",
          scrolled
            ? "bg-background/70 border-b border-default-200"
            : "bg-transparent",
        ),
      }}
      isBlurred={scrolled}
      maxWidth="xl"
      position="sticky"
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink
            className="nav-logo-glow flex justify-start items-center gap-1"
            href="/"
          >
            <Logo />
            <p className="font-display font-bold text-inherit">Solence</p>
          </NextLink>
        </NavbarBrand>
        <ul className="hidden lg:flex gap-6 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <NextLink
                className="nav-link-indicator text-sm text-foreground"
                data-active={
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href)
                }
                href={item.href}
              >
                {item.label}
              </NextLink>
            </NavbarItem>
          ))}
        </ul>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          <ThemeSwitch />
        </NavbarItem>
        <NavbarItem className="hidden lg:flex">
          <NextLink
            className="nav-cta-glow bg-brand-teal-dark hover:bg-brand-teal transition-colors px-4 py-1.5 rounded-control text-white text-sm font-medium"
            href="/projects"
          >
            Open Projects
          </NextLink>
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        <div className="nav-menu-stagger mx-4 mt-2 flex flex-col gap-3">
          {siteConfig.navMenuItems.map((item) => (
            <NavbarMenuItem key={item.href}>
              <Link
                className={clsx(
                  "text-lg",
                  pathname === item.href ? "text-primary" : "text-foreground",
                )}
                href={item.href}
                size="lg"
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
