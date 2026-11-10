"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";

// Animación chica (ease-out, ~700ms) para que los números grandes del
// Dashboard no aparezcan de golpe. Puramente visual — el valor final
// siempre es el mismo que calculó el server, esto solo anima el camino
// de 0 hasta ahí con requestAnimationFrame (sin librerías).
//
// "format" va como string (no como función): este componente es
// "use client" y lo renderiza un Server Component (page.tsx), que NO
// puede pasarle una función como prop (Next.js solo serializa datos
// entre server y client). El formateo real se hace acá adentro,
// importando formatCurrency directo — eso sí está permitido.
export function CountUp({
  value,
  format,
  durationMs = 700,
  className,
}: {
  value: number;
  format?: "currency";
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{format === "currency" ? formatCurrency(display) : display}</span>;
}