"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

// Glow sutil que sigue el mouse al pasar por arriba de una tarjeta —
// detalle chico (no es un efecto 3D ni nada que distraiga), solo marca
// mejor dónde está el cursor en paneles grandes. Se actualiza vía CSS
// variables en el propio nodo, nunca con un loop de animación, así que
// no cuesta nada mientras el mouse no se mueve sobre la tarjeta.
export function SpotlightCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spotlight-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spotlight-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={cn("group/spotlight relative overflow-hidden", className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100"
        style={{
          // Color de marca (#021530) a mano, no vía variable CSS — este
          // proyecto define los colores en tailwind.config.ts, no en
          // :root, así que un "hsl(var(--primary))" acá quedaría roto.
          background:
            "radial-gradient(360px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), rgba(2, 21, 48, 0.08), transparent 70%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}