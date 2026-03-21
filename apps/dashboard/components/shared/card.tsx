import { HTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode
  footer?: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({
  header,
  footer,
  padding = 'md',
  hoverable = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        'bg-gray-800 border border-gray-700 rounded-xl',
        hoverable && 'hover:border-gray-600 hover:bg-gray-750 transition-all duration-150 cursor-pointer',
        className
      )}
      {...props}
    >
      {header && (
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          {header}
        </div>
      )}
      <div className={clsx(padding !== 'none' ? paddingClasses[padding] : '')}>{children}</div>
      {footer && (
        <div className="px-5 py-4 border-t border-gray-700 bg-gray-800/60 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  )
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <h3 className={clsx('text-sm font-semibold text-white', className)} {...props}>
      {children}
    </h3>
  )
}

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <p className={clsx('text-xs text-gray-400 mt-0.5', className)} {...props}>
      {children}
    </p>
  )
}
