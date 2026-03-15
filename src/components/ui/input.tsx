import * as React from "react";

const inputBase =
  "w-full rounded-lg border bg-white px-3 py-2 text-nord-polar placeholder-nord-polarLighter transition-colors focus:outline-none focus:ring-1 disabled:pointer-events-none disabled:opacity-50";

const inputBorder = "border-nord-polarLighter focus:border-nord-frostDark focus:ring-nord-frostDark";
const inputError = "border-red-500 focus:border-red-500 focus:ring-red-500";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  id?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, id: idProp, ...props }, ref) => {
    const generatedId = React.useId();
    const id = idProp ?? generatedId;
    const hasError = Boolean(error);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="mb-1 block text-sm font-medium text-nord-polar"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          className={`${inputBase} ${hasError ? inputError : inputBorder} ${className}`.trim()}
          {...props}
        />
        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="mt-1 text-sm text-red-600"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
