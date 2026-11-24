"use client";

import { useMemo } from "react";
import type { ProyectoDoc } from "./pipeline-client";

// Gantt simple, 100% calculado en el cliente a partir de start/end de cada
// proyecto — igual que el original (renderGantt), sin colección propia en
// Firestore. Excluye finalizados (igual que el original); si un proyecto
// vendido tiene datos de obra (p.obra.start/end, cargados desde la otra app)
// se dibuja una segunda barra más clara para esa etapa, para no perder esa
// info si ya existe en Firestore.
//
// Responsive a propósito (PC/celu/tablet, pedido explícito de Ariel): el
// contenedor de barras scrollea horizontal en pantallas chicas en vez de
// achicar las barras hasta hacerlas ilegibles — mismo patrón que ya usa
// <Table> en el resto de PayFlow (overflow-auto).
const MS_DIA = 24 * 60 * 60 * 1000;

function parseFecha(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export function Cronograma({ proyectos }: { proyectos: ProyectoDoc[] }) {
  const vigentes = useMemo(() => proyectos.filter((p) => p.status !== "finalizado"), [proyectos]);

  const rango = useMemo(() => {
    let min: number | null = null;
    let max: number | null = null;
    vigentes.forEach((p) => {
      const obra = p.obra as { start?: string; end?: string } | undefined;
      [p.start, p.end, obra?.start, obra?.end].forEach((iso) => {
        const t = parseFecha(iso);
        if (t === null) return;
        if (min === null || t < min) min = t;
        if (max === null || t > max) max = t;
      });
    });
    return { min, max };
  }, [vigentes]);

  if (vigentes.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No hay proyectos vigentes para mostrar.</p>;
  }
  if (rango.min === null || rango.max === null) {
    return <p className="p-4 text-sm text-muted-foreground">Ninguno de estos proyectos tiene fechas cargadas todavía.</p>;
  }

  // Un día de margen a cada lado para que las barras de los extremos no
  // queden pegadas al borde.
  const inicio = rango.min - MS_DIA;
  const fin = rango.max + MS_DIA;
  const total = Math.max(fin - inicio, MS_DIA);

  function pos(iso?: string): { left: number; width: number } | null {
    const t0 = parseFecha(iso);
    if (t0 === null) return null;
    const left = ((t0 - inicio) / total) * 100;
    return { left, width: 0 };
  }

  function barra(startIso?: string, endIso?: string) {
    const t0 = parseFecha(startIso) ?? inicio;
    const t1 = parseFecha(endIso) ?? t0 + MS_DIA;
    const left = ((Math.min(t0, t1) - inicio) / total) * 100;
    const width = Math.max(((Math.abs(t1 - t0) || MS_DIA) / total) * 100, 1);
    return { left, width };
  }

  const hoy = pos(new Date().toISOString().slice(0, 10));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className="min-w-[640px]">
        {vigentes.map((p) => {
          const b = barra(p.start, p.end);
          const obra = p.obra as { start?: string; end?: string } | undefined;
          const bObra = obra && (obra.start || obra.end) ? barra(obra.start, obra.end) : null;
          return (
            <div key={p.id} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
              <div className="w-36 shrink-0 truncate text-xs font-medium" title={p.name}>
                {p.name}
              </div>
              <div className="relative h-6 flex-1 rounded bg-muted/50">
                {hoy && hoy.left >= 0 && hoy.left <= 100 && (
                  <div className="absolute top-0 h-full w-px bg-destructive/60" style={{ left: `${hoy.left}%` }} />
                )}
                <div
                  className="absolute top-1 h-4 rounded-full opacity-90"
                  style={{ left: `${b.left}%`, width: `${b.width}%`, backgroundColor: p.color }}
                  title={`${p.name}: ${p.start ?? "?"} a ${p.end ?? "?"}`}
                />
                {bObra && (
                  <div
                    className="absolute top-1 h-4 rounded-full border border-dashed"
                    style={{ left: `${bObra.left}%`, width: `${bObra.width}%`, borderColor: p.color }}
                    title="Etapa de obra"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
