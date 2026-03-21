'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export type ButtonVariant = 'default' | 'primary' | 'destructive' | 'ghost' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-gray-700 light:bg-gray-200 text-gray-100 light:text-gray-900 hover:bg-gray-600 light:hover:bg-gray-300 border border-gray-600 light:border-gray-300 hover:border-gray-500 light:hover:border-gray-400',
  primary:
    'bg-brand-600 text-white hover:bg-brand-500 border border-brand-500 hover:border-brand-400 shadow-sm shadow-brand-900/50 light:shadow-brand-200/50',
  destructive:
    'bg-red-700 light:bg-red-600 text-white hover:bg-red-600 light:hover:bg-red-500 border border-red-600 light:border-red-500 hover:border-red-500 light:hover:border-red-400',
  ghost:
    'bg-transparent text-gray-300 light:text-gray-700 hover:bg-gray-800 light:hover:bg-gray-100 hover:text-white light:hover:text-gray-900 border border-transparent',
  outline:
    'bg-transparent text-gray-200 light:text-gray-700 hover:bg-gray-800 light:hover:bg-gray-100 border border-gray-600 light:border-gray-300 hover:border-gray-400 light:hover:border-gray-400',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium rounded-md gap-1.5',
  md: 'px-4 py-2 text-sm font-medium rounded-lg gap-2',
  lg: 'px-5 py-2.5 text-base font-semibold rounded-lg gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-gray-900 light:focus:ring-offset-white',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
