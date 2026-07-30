import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface IconInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon: ReactNode;
}

export function IconInput({ icon, className, ...props }: IconInputProps) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary">
        {icon}
      </span>
      <input
        className={cn(
          'h-12 w-full rounded-2xl border border-white/15 bg-surface px-4 pl-10 text-sm text-foreground shadow-[inset_0_1px_4px_rgba(255,255,255,0.05),inset_0_-1px_4px_rgba(0,0,0,0.6)] outline-none transition-all duration-200 placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/25',
          className
        )}
        {...props}
      />
    </label>
  );
}
