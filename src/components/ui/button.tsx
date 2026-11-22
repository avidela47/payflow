import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        outline:
          "border border-border bg-background hover:bg-muted text-foreground",
        ghost: "hover:bg-muted text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        // "Editar"/"Borrar" en pastilla verde/roja — pedido explícito de
        // Ariel (2026-11-22) para que estos dos botones se vean siempre
        // igual en TODA la app, mismo estilo que ya usaban los botones de
        // movimiento (Compra/Ajuste) en Componentes.
        edit: "border border-success text-success bg-transparent hover:bg-success/10",
        delete: "border border-destructive text-destructive bg-transparent hover:bg-destructive/10",
        // Misma pastilla que edit/delete pero en azul — para acciones que no
        // son ni "editar" ni "borrar" (ej. Devolución en Materiales), sin
        // forzarlas al binario verde/rojo donde no corresponde.
        info: "border border-primary text-primary bg-transparent hover:bg-primary/10",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };