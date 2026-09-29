import React from "react";
import { cn } from "@/lib/utils";
 
function hexToRgba(hex: string, alpha: number = 1): string {
  let hexValue = hex.replace("#", "");
 
  if (hexValue.length === 3) {
    hexValue = hexValue
      .split("")
      .map((char) => char + char)
      .join("");
  }
 
  const r = parseInt(hexValue.substring(0, 2), 16);
  const g = parseInt(hexValue.substring(2, 4), 16);
  const b = parseInt(hexValue.substring(4, 6), 16);
 
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.error("Invalid hex color:", hex);
    return "rgba(0, 0, 0, 1)";
  }
 
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
 
export function GlowingButton({
  children,
  className,
  glowColor = "#a3e635",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  glowColor?: string;
}) {
  const glowColorRgba = hexToRgba(glowColor);
  const glowColorVia = hexToRgba(glowColor, 0.075);
  const glowColorTo = hexToRgba(glowColor, 0.2);
 
  return (
    <button
      {...props}
      style={
        {
          "--glow-color": glowColorRgba,
          "--glow-color-via": glowColorVia,
          "--glow-color-to": glowColorTo,
        } as React.CSSProperties
      }
      className={cn(
        "shrink-0 h-11 px-6 text-sm font-semibold rounded-md border flex items-center justify-center relative transition-colors overflow-hidden bg-gradient-to-t border-r-0 duration-200 whitespace-nowrap",
        "from-[#111113] to-[#1c1c1f] text-white hover:text-white/70 border-white/10",
        "after:inset-0 after:absolute after:rounded-[inherit] after:bg-gradient-to-r after:from-transparent after:from-40% after:via-[var(--glow-color-via)] after:to-[var(--glow-color-to)] after:via-70% after:pointer-events-none",
        "before:absolute before:w-[5px] hover:before:translate-x-full before:transition-all before:duration-200 before:h-[60%] before:bg-[var(--glow-color)] before:right-0 before:rounded-l before:shadow-[-2px_0_10px_var(--glow-color)] before:pointer-events-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}
