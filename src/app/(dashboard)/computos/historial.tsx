"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Pencil, Copy, Trash2 } from "lucide-react";
import { collection, doc, setDoc, deleteDoc } from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { logActivity } from "@/lib/proyectos-activity";
import { generarPdfComputo } from "@/lib/computos-pdf";
import { teamMemberById } from "@/lib/proyectos-team";
import { Button } from "@/components/ui/button";
import type { ComputoDoc, Luminaria } from "./computos-client";

// Historial — Fase 4 (última) del Generador de Cómputos. Port de
// renderCGHist en /tmp/protectos-itelsa/index.html (líneas 2702-2740): lista
// todos los cómputos (abiertos y cerrados), con PDF/Editar/Duplicar para los
// cerrados y Continuar para los abiertos. "Editar" reabre (queda registrado
// en `reaperturas`, igual que el original) en vez de permitir tocar un
// cómputo cerrado directamente — así el PDF viejo nunca queda desincronizado
// en silencio con los datos.

function fmtFecha(iso?: string): string {
  if (!iso) return "sin fecha";
  const p = String(iso).split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return String(iso);
}

export function Historial({
  computos,
  luminarias,
  quienSos,
  onAbrir,
}: {
  computos: ComputoDoc[];
  luminarias: Luminaria[];
  quienSos: string;
  onAbrir: (id: string) => void;
}) {
  const [procesando, setProcesando] = useState<string | null>(null);
  const lista = [...computos].sort((a, b) => (b.ts || 0) - (a.ts || 0));

  if (lista.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Todavía no hay cómputos.</p>;
  }

  async function descargarPdf(c: ComputoDoc) {
    setProcesando(c.id);
    try {
      await generarPdfComputo(c, luminarias);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    } finally {
      setProcesando(null);
    }
  }

  async function reabrir(c: ComputoDoc) {
    if (!confirm(`¿Reabrir el cómputo de "${c.proyecto}" para modificarlo? Cuando termines, cerralo de nuevo para actualizar el PDF.`))
      return;
    const reaperturas = [...(c.reaperturas ?? []), { ts: Date.now(), by: quienSos, cerradoAntes: c.cerrado ?? "" }];
    try {
      await setDoc(doc(dbProyectos, "computosGen", c.id), { estado: "abierto", reaperturas, ts: Date.now() }, { merge: true });
      logActivity("reabrio para editar un computo de luminarias", c.proyecto, quienSos);
      onAbrir(c.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reabrir.");
    }
  }

  async function duplicar(c: ComputoDoc) {
    try {
      const ref = doc(collection(dbProyectos, "computosGen"));
      const nuevo: ComputoDoc = {
        id: ref.id,
        proyecto: c.proyecto,
        creado: new Date().toISOString().slice(0, 10),
        items: JSON.parse(JSON.stringify(c.items ?? [])),
        estado: "abierto",
        by: quienSos,
        ts: Date.now(),
        basadoEn: c.id,
        ...(c.plano ? { plano: JSON.parse(JSON.stringify(c.plano)), marcas: JSON.parse(JSON.stringify(c.marcas ?? [])) } : {}),
      };
      await setDoc(ref, nuevo);
      onAbrir(ref.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar.");
    }
  }

  async function eliminar(c: ComputoDoc) {
    if (!confirm(`¿Eliminar el cómputo de "${c.proyecto}"?`)) return;
    try {
      await deleteDoc(doc(dbProyectos, "computosGen", c.id));
      toast.success("Cómputo eliminado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {lista.map((c) => {
        const tot = c.items.reduce((s, it) => s + (Number(it.cant) || 0), 0);
        const reaperturas = c.reaperturas ?? [];
        return (
          <div
            key={c.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">{c.proyecto}</div>
              <div className="text-xs text-muted-foreground">
                {c.estado === "cerrado" ? `Cerrado el ${fmtFecha(c.cerrado)}` : `Abierto desde el ${fmtFecha(c.creado)}`}
                {` — ${c.items.length} tipos, ${tot} luminarias — ${teamMemberById(c.cerradoPor || c.by)?.name ?? ""}`}
                {reaperturas.length > 0 && ` — modificado ${reaperturas.length} ${reaperturas.length > 1 ? "veces" : "vez"}`}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  c.estado === "cerrado" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                }`}
              >
                {c.estado === "cerrado" ? "Cerrado" : "Abierto"}
              </span>
              {c.estado === "cerrado" ? (
                <>
                  <Button size="sm" variant="outline" disabled={procesando === c.id} onClick={() => descargarPdf(c)}>
                    <Download className="h-3.5 w-3.5" />
                    {procesando === c.id ? "Generando..." : "PDF"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Reabre este cómputo para corregirlo; al volver a cerrarlo se actualiza el PDF"
                    onClick={() => reabrir(c)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Para un cambio de proyecto: copia las luminarias en un cómputo nuevo"
                    onClick={() => duplicar(c)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Nuevo a partir de este
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => onAbrir(c.id)}>
                  Continuar
                </Button>
              )}
              <Button size="sm" variant="delete" className="h-8 w-8 p-0" title="Eliminar" onClick={() => eliminar(c)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
