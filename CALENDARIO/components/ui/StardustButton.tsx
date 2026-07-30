import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface StardustButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

export function StardustButton({
  children = 'Entrar',
  className,
  type = 'button',
  ...props
}: StardustButtonProps) {
  return (
    <button type={type} className={cn('stardust-btn', className)} {...props}>
      <span className="stardust-btn__wrap">{children}</span>
    </button>
  );
}
