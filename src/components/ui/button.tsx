import * as React from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary:
    "bg-nord-frostDark text-white hover:opacity-90 focus:ring-nord-frostDark",
  secondary:
    "border border-nord-polarLighter bg-white text-nord-polar hover:bg-nord-snow focus:ring-nord-frostDark",
  ghost:
    "text-nord-polarLight hover:bg-nord-snow hover:text-nord-polar focus:ring-nord-frostDark",
  danger:
    "bg-red-600 text-white hover:opacity-90 focus:ring-red-500",
  success:
    "bg-pitch-grass text-white hover:opacity-90 focus:ring-pitch-grass",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  default: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
  full: "w-full py-2.5 text-sm",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "default",
      type = "button",
      asChild = false,
      ...props
    },
    ref
  ) => {
    const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
    if (asChild && React.isValidElement(props.children)) {
      const child = props.children as React.ReactElement<{ className?: string; ref?: React.Ref<unknown> }>;
      return React.cloneElement(child, {
        ...child.props,
        className: [child.props?.className, classes].filter(Boolean).join(" "),
        ref,
      });
    }
    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
