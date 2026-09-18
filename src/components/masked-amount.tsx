"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// A diferencia del reveal de Vault, esto NO es un límite de seguridad real:
// el valor ya viene renderizado en el HTML/props del server, sin cifrar.
// Es solo un toggle visual del lado del cliente (mismo lenguaje visual que
// Vault: puntitos + ícono de ojo), pensado para que la contadora no tenga
// el importe a la vista por defecto en pantalla compartida/proyector.
export function MaskedAmount({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setRevealed((r) => !r);
      }}
      title={revealed ? "Ocultar importe" : "Mostrar importe"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded transition-colors hover:text-primary",
        className
      )}
    >
      <span className={cn(!revealed && "tracking-widest")}>
        {revealed ? value : "••••••"}
      </span>
      {revealed ? (
        <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}