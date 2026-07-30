import React, { InputHTMLAttributes, useState } from 'react';

interface NeonCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  color?: string;
  size?: number;
}

const NeonCheckbox: React.FC<NeonCheckboxProps> = ({
  label,
  className = '',
  color = '#00ffaa',
  size = 22,
  checked: controlledChecked,
  defaultChecked,
  onChange,
  ...props
}) => {
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);
  const isControlled = controlledChecked !== undefined;
  const isChecked = isControlled ? controlledChecked : internalChecked;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setInternalChecked(e.target.checked);
    onChange?.(e);
  };

  const cssVars = {
    '--neon-primary': color,
    '--neon-size': `${size}px`,
  } as React.CSSProperties;

  const xOffsets = ['25px', '-25px', '25px', '-25px', '35px', '-35px', '0px', '0px', '20px', '-20px', '30px', '-30px'];
  const yOffsets = ['-25px', '-25px', '25px', '25px', '0px', '0px', '35px', '-35px', '-30px', '30px', '20px', '-20px'];

  return (
    <label
      className={`relative inline-flex items-center gap-2.5 cursor-pointer select-none ${className}`}
      style={cssVars}
    >
      <input
        type="checkbox"
        className="hidden"
        checked={isChecked}
        onChange={handleChange}
        {...props}
      />

      {/* Checkbox frame */}
      <div className="relative flex-shrink-0 w-[var(--neon-size)] h-[var(--neon-size)]">
        {/* Box */}
        <div
          className={`absolute inset-0 bg-black/80 rounded border-2 transition-all duration-[400ms]`}
          style={{
            borderColor: isChecked ? color : `${color}55`,
            backgroundColor: isChecked ? `${color}15` : undefined,
          }}
        >
          {/* SVG checkmark */}
          <div className="absolute inset-[2px] flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className={`w-4/5 h-4/5 fill-none stroke-[3] [stroke-linecap:round] [stroke-linejoin:round]
                         [stroke-dasharray:40] origin-center transition-all duration-[400ms]
                         ease-[cubic-bezier(0.16,1,0.3,1)]
                         ${isChecked ? '[stroke-dashoffset:0] scale-110' : '[stroke-dashoffset:40]'}`}
              style={{ stroke: color }}
            >
              <path d="M3,12.5l7,7L21,5" />
            </svg>
          </div>

          {/* Glow */}
          <div
            className={`absolute -inset-0.5 rounded-md blur-md transition-opacity duration-[400ms]
                       ${isChecked ? 'opacity-20' : 'opacity-0'}`}
            style={{ backgroundColor: color }}
          />

        </div>

        {/* Particles */}
        <div className="absolute inset-0 pointer-events-none">
          {xOffsets.map((x, i) => (
            <span
              key={i}
              className={`absolute w-1 h-1 rounded-full top-1/2 left-1/2
                         ${isChecked ? 'animate-[neonParticle_0.6s_ease-out_forwards]' : 'opacity-0'}`}
              style={{
                backgroundColor: color,
                boxShadow: `0 0 6px ${color}`,
                '--x': x,
                '--y': yOffsets[i],
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Rings */}
        <div className="absolute -inset-5 pointer-events-none">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`absolute inset-0 rounded-full scale-0
                         ${isChecked ? 'animate-[neonRing_0.6s_ease-out_forwards]' : 'opacity-0'}`}
              style={{
                border: `1px solid ${color}`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>

        {/* Sparks */}
        <div className="absolute inset-0 pointer-events-none">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`absolute w-5 h-px top-1/2 left-1/2
                         ${isChecked ? 'animate-[neonSpark_0.6s_ease-out_forwards]' : 'opacity-0'}`}
              style={{
                background: `linear-gradient(to right, ${color}, transparent)`,
                '--r': `${i * 90}deg`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      {label && <span>{label}</span>}
    </label>
  );
};

export { NeonCheckbox };
