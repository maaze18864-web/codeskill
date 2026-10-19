import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-[var(--ds-control-height)] w-full min-w-0 rounded-[var(--ds-radius-control)] border border-input bg-background px-[var(--ds-space-3)] text-[length:var(--ds-font-sm)] transition-colors duration-[var(--ds-motion-duration)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
