"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, ZoomIn, ZoomOut, MapPin } from "lucide-react";
import { doc, setDoc, deleteDoc, getDoc, collection, deleteField } from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { procesarPlano } from "@/lib/computos-plano";
import { colorDeItem } from "@/lib/computos-colors";
import { Button } from "@/components/ui/button";
import type { ComputoDoc } from "./computos-client";

// Plano interactivo con marcadores — Fase 3 del Generador de Cómputos. Port
// de renderCGPlano/cgSubirPlano/cgQuitarPlano/el onclick del stage en
// /tmp/protectos-itelsa/index.html (líneas ~2342-2522). El plano se guarda
// en su propia colección Firestore "gfiles" (no como campo del cómputo,
// igual que el original), referenciado por `plano.fileId`; cada marcador es
// {u: uid del ítem, x, y} con x/y de 0 a 1 (porcentaje de la imagen), igual
// que el original.

const planoCache = new Map<string, string>();

async function cargarPlano(fileId: string): Promise<string | null> {
  if (planoCache.has(fileId)) return planoCache.get(fileId) ?? null;
  const snap = await getDoc(doc(dbProyectos, "gfiles", fileId));
  if (!snap.exists()) return null;
  const data = (snap.data() as { data: string }).data;
  planoCache.set(fileId, data);
  return data;
}

export function PlanoEditor({
  computo,
  onUpdate,
}: {
  computo: ComputoDoc;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [zoom, setZoom] = useState(1);
  const [src, setSrc] = useState<string | null>(null);
  const [marcaSel, setMarcaSel] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = computo.items;
  const marcas = computo.marcas ?? [];

  useEffect(() => {
    if (!computo.plano?.fileId) {
      setSrc(null);
      return;
    }
    let activo = true;
    cargarPlano(computo.plano.fileId).then((d) => {
      if (activo) setSrc(d);
    });
    return () => {
      activo = false;
    };
  }, [computo.plano?.fileId]);

  useEffect(() => {
    if (marcaSel && !items.some((it) => it.uid === marcaSel)) setMarcaSel(null);
    if (!marcaSel && items.length) setMarcaSel(items[0].uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  async function subir(file: File) {
    setSubiendo(true);
    try {
      const res = await procesarPlano(file);
      if (!res) {
        toast.error("No se pudo procesar el plano. Probá con una imagen JPG/PNG o un PDF más liviano.");
        return;
      }
      const oldId = computo.plano?.fileId;
      const fid = doc(collection(dbProyectos, "gfiles")).id;
      await setDoc(doc(dbProyectos, "gfiles", fid), {
        id: fid,
        compId: computo.id,
        tipo: "plano",
        name: file.name,
        type: "image/jpeg",
        data: res.data,
        w: res.w,
        h: res.h,
      });
      planoCache.set(fid, res.data);
      let marcasNuevas = computo.marcas ?? [];
      if (oldId && marcasNuevas.length) {
        if (!confirm("¿Mantener las ubicaciones ya marcadas sobre el plano nuevo? (Aceptar = mantener, Cancelar = borrarlas)")) {
          marcasNuevas = [];
        }
      }
      await onUpdate({
        plano: { fileId: fid, name: file.name, w: res.w, h: res.h, subido: new Date().toLocaleString("es-AR") },
        marcas: marcasNuevas,
      });
      if (oldId) void deleteDoc(doc(dbProyectos, "gfiles", oldId));
      toast.success("Plano cargado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el plano.");
    } finally {
      setSubiendo(false);
    }
  }

  async function quitar() {
    if (!computo.plano) return;
    if (!confirm("¿Quitar el plano y todas las ubicaciones marcadas?")) return;
    const oldId = computo.plano.fileId;
    await onUpdate({ plano: deleteField(), marcas: [] });
    void deleteDoc(doc(dbProyectos, "gfiles", oldId));
  }

  function clickEnPlano(e: React.MouseEvent<HTMLDivElement>) {
    if (!items.length || !marcaSel) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    void onUpdate({ marcas: [...marcas, { u: marcaSel, x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000 }] });
  }

  function borrarMarca(idx: number) {
    void onUpdate({ marcas: marcas.filter((_, i) => i !== idx) });
  }

  const asp = computo.plano?.w && computo.plano?.h ? computo.plano.w / computo.plano.h : 1.4;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-primary" />
            Plano y ubicación de luminarias <span className="font-normal text-muted-foreground">(opcional)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {computo.plano
              ? `${computo.plano.name || "Plano"}${computo.plano.subido ? ` — subido el ${computo.plano.subido}` : ""}`
              : "Subí el plano (imagen o PDF) y marcá dónde va cada luminaria. Sale en el PDF del cómputo."}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {computo.plano && (
            <>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} title="Alejar">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-10 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} title="Acercar">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" disabled={subiendo} onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            {subiendo ? "Procesando..." : computo.plano ? "Cambiar plano" : "Subir plano"}
          </Button>
          {computo.plano && (
            <Button size="sm" variant="delete" onClick={quitar}>
              <Trash2 className="h-3.5 w-3.5" />
              Quitar
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subir(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {computo.plano && (
        <>
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Agregá luminarias al cómputo para poder ubicarlas en el plano.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {items.map((it, idx) => {
                const n = marcas.filter((m) => m.u === it.uid).length;
                const cant = Number(it.cant) || 0;
                return (
                  <button
                    key={it.uid}
                    type="button"
                    onClick={() => setMarcaSel(it.uid)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                      marcaSel === it.uid ? "border-primary bg-primary/10" : "border-border"
                    }`}
                    title={`${it.nombre || ""}${it.comentario ? ` - ${it.comentario}` : ""}`}
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: colorDeItem(idx) }}
                    >
                      {idx + 1}
                    </span>
                    <span>{it.codigo || it.nombre || "Luminaria"}</span>
                    <span className={n >= cant && cant ? "font-semibold text-primary" : "text-muted-foreground"}>
                      {n}/{cant}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {items.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Elegí la luminaria arriba y hacé clic en el plano donde va. Clic sobre un punto para borrarlo. No es obligatorio ubicar
              todas.
            </p>
          )}

          <div className="overflow-auto rounded-md border border-border" style={{ maxHeight: "70vh" }}>
            <div className="relative mx-auto" style={{ width: `min(${zoom * 100}%, calc(70vh * ${asp}))` }} onClick={clickEnPlano}>
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="Plano" draggable={false} className="w-full select-none" />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Cargando plano…</div>
              )}
              {marcas.map((m, mi) => {
                const idx = items.findIndex((it) => it.uid === m.u);
                if (idx < 0) return null;
                const it = items[idx];
                return (
                  <div
                    key={mi}
                    onClick={(e) => {
                      e.stopPropagation();
                      borrarMarca(mi);
                    }}
                    title={`#${idx + 1} ${it.codigo || it.nombre || ""} - clic para borrar`}
                    className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[11px] font-bold text-white shadow"
                    style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, backgroundColor: colorDeItem(idx) }}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
