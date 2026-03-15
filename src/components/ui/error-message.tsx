import * as React from "react";

const variants = {
  error:
    "bg-red-50 border-red-200 text-red-800",
  success:
    "bg-green-50 border-green-200 text-green-800",
  warning:
    "bg-amber-50 border-amber-200 text-amber-800",
  info:
    "bg-nord-snow/80 border-nord-polarLighter/50 text-nord-polar",
} as const;

export type ErrorMessageVariant = keyof typeof variants;

export interface ErrorMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ErrorMessageVariant;
  title?: string;
}

function ErrorMessage({
  className = "",
  variant = "error",
  title,
  children,
  ...props
}: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={`rounded-lg border px-4 py-3 text-sm ${variants[variant]} ${className}`.trim()}
      {...props}
    >
      {title && <strong className="block font-medium">{title}</strong>}
      {children && (title ? <div className="mt-0.5">{children}</div> : children)}
    </div>
  );
}

export { ErrorMessage };
