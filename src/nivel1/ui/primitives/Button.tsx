import React from 'react';
import { cn } from '../../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
	size?: 'sm' | 'md' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = 'primary', size = 'md', ...props }, ref) => {
		const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
    
		const variantStyles = {
			primary: 'bg-emerald-500 text-white hover:bg-emerald-600',
			secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
			outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
			ghost: 'hover:bg-accent hover:text-accent-foreground',
			destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
		} as const;
    
		const sizeStyles = {
			sm: 'h-8 px-3 text-xs',
			md: 'h-9 px-4 text-sm',
			lg: 'h-10 px-6 text-base',
		} as const;
    
		return (
			<button
				className={cn(
					baseStyles,
					variantStyles[variant],
					sizeStyles[size],
					className
				)}
				ref={ref}
				{...props}
			/>
		);
	}
);
Button.displayName = 'Button';

export default Button;