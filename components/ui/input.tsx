import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** Thin styled wrappers over the .input/.select/.textarea token classes. */

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => <input ref={ref} className={cn("input", className)} {...rest} />,
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...rest }, ref) => <select ref={ref} className={cn("select", className)} {...rest} />,
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => <textarea ref={ref} className={cn("textarea", className)} {...rest} />,
);
Textarea.displayName = "Textarea";
