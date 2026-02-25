"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";

import { cn } from "./utils";

const toggleVariants = {
  variant: {
    default: "hover:bg-muted hover:text-muted-foreground",
    outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
  },
  size: {
    default: "h-9 px-3",
    sm: "h-8 px-2",
    lg: "h-10 px-3",
  },
};

type ToggleVariant = keyof typeof toggleVariants.variant;
type ToggleSize = keyof typeof toggleVariants.size;

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & {
    variant?: ToggleVariant;
    size?: ToggleSize;
  }
>(({ className, variant = "default", size = "default", ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap",
      toggleVariants.variant[variant],
      toggleVariants.size[size],
      className
    )}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
