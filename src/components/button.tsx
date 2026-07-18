"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

type Variant = "primary" | "ghost" | "outline" | "danger";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
}

/**
 * Native-feel button with iOS spring physics + haptic on press.
 * - While pressed: scales to 0.97, slight brightness shift
 * - On release: spring back with iOS signature bounce
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", fullWidth, className, onClick, children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 22, mass: 0.6 }}
      onClick={(e) => {
        if (disabled) return;
        haptic("light");
        onClick?.(e);
      }}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-medium transition-colors",
        "disabled:opacity-40 disabled:pointer-events-none select-none",
        // Min 44pt tap target (iOS HIG)
        "min-h-[44px]",
        variant === "primary" && "bg-accent text-black active:bg-accent/90",
        variant === "ghost" && "bg-elev1 text-fg active:bg-elev2",
        variant === "outline" &&
          "border border-border text-fg bg-transparent active:bg-elev1",
        variant === "danger" && "bg-bad/15 text-bad active:bg-bad/25",
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
