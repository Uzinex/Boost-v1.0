import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { clsx } from 'clsx';

type ButtonVariant = 'primary' | 'ghost' | 'link';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClassNames: Record<ButtonVariant, string> = {
  primary: 'button',
  ghost: 'link-button',
  link: 'link-button'
};

export const Button = ({ children, className, variant = 'primary', ...props }: PropsWithChildren<ButtonProps>) => (
  <button className={clsx(variantClassNames[variant], className)} {...props}>
    {children}
  </button>
);
