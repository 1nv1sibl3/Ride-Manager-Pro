import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const SIZES: Record<Size, string> = { sm: "btn-sm", md: "" };

/** Class string for rendering a button-styled element (e.g. a next/link). */
export function buttonClass(variant: Variant = "secondary", size: Size = "md") {
  return cn("btn", VARIANTS[variant], SIZES[size]);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", loading, disabled, className, children, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonClass(variant, size), className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
