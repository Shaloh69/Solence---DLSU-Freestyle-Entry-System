import { tv } from "tailwind-variants";

/**
 * Text primitives per /DESIGN.md §3. Headlines use the display font
 * (Space Grotesk); the only permitted gradient is the brand teal one.
 * The old HeroUI rainbow variants (violet/pink/…) are banned — see
 * DESIGN.md §7.
 */
export const title = tv({
  base: "tracking-tight inline font-semibold font-display",
  variants: {
    color: {
      brand: "from-[#14B8A6] to-[#0D9488]",
      amber: "from-[#F59E0B] to-[#B45309]",
      foreground: "dark:from-[#E6EDF7] dark:to-[#93A5C1]",
    },
    size: {
      sm: "text-3xl lg:text-4xl",
      md: "text-[2.3rem] lg:text-5xl leading-9",
      lg: "text-4xl lg:text-6xl",
    },
    fullWidth: {
      true: "w-full block",
    },
  },
  defaultVariants: {
    size: "md",
  },
  compoundVariants: [
    {
      color: ["brand", "amber", "foreground"],
      class: "bg-clip-text text-transparent bg-gradient-to-b",
    },
  ],
});

export const subtitle = tv({
  base: "w-full md:w-1/2 my-2 text-lg lg:text-xl text-default-600 block max-w-full",
  variants: {
    fullWidth: {
      true: "!w-full",
    },
  },
  defaultVariants: {
    fullWidth: true,
  },
});
