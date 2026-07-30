import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'icon';
}

const variantClass = {
  primary:
    'border-primary bg-primary text-primary-foreground shadow-[0_0_14px_rgba(106,61,255,0.35)] hover:bg-primary-soft',
  secondary:
    'border-border bg-surface-strong text-foreground hover:border-primary/50 hover:bg-surface',
  ghost:
    'border-transparent bg-transparent text-muted hover:bg-white/10 hover:text-foreground',
  danger:
    'border-red-500/35 bg-red-500/10 text-red-200 hover:border-red-500/60 hover:bg-red-500/15',
};

const sizeClass = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  icon: 'size-10 rounded-xl p-0',
};

export function Button({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl border font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
