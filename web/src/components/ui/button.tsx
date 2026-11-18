import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent bg-clip-padding text-sm font-normal whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-subtle hover:bg-primary/90",
        outline:
          "border-border bg-card text-foreground hover:border-primary hover:text-primary aria-expanded:border-primary aria-expanded:text-primary [&_svg]:text-foreground/80 [&_svg]:hover:text-primary",
        secondary:
          "border-border bg-card text-foreground hover:border-primary hover:text-primary aria-expanded:border-primary aria-expanded:text-primary",
        ghost:
          "bg-transparent text-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive:
          "bg-destructive text-primary-foreground shadow-subtle hover:bg-destructive/90 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:text-primary/80 hover:underline",
      },
      size: {
        // antd control heights: small 24, middle 32, large 40.
        default: "h-8 px-4",
        sm: "h-6 gap-1 px-2 text-xs",
        lg: "h-10 gap-2 px-4",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
