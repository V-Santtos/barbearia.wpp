import { cn } from '../../lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex rounded-full border border-white/10 bg-black/35 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_28px_rgba(0,0,0,0.22),0_0_16px_rgba(106,61,255,0.08)] backdrop-blur-md',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'h-10 min-w-[88px] rounded-full px-4 text-sm font-medium transition-[background-color,box-shadow,color,filter] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              active
                ? 'bg-white/[0.09] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_10px_rgba(168,85,247,0.12)]'
                : 'text-muted hover:bg-white/[0.04] hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
