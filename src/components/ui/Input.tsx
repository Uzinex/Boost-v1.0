import type { InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = ({ error, label, className, ...props }: InputProps) => (
  <div className="form-field">
    {label && <label htmlFor={props.id}>{label}</label>}
    <input className={clsx('input', className)} {...props} />
    {error && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{error}</span>}
  </div>
);
