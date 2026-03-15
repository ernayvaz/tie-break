import * as React from "react";

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  default: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
} as const;

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg";
}

function Spinner({ className = "", size = "default", ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-nord-polarLighter border-t-nord-frostDark ${sizeClasses[size]} ${className}`.trim()}
      {...props}
    >
      <span className="sr-only">Loading</span>
    </div>
  );
}

export { Spinner };
