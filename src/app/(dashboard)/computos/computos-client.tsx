"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X, Search } from "lucide-react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { logActivity } from "@/lib/proyectos-activity";
import { useQuienSos, QuienSos } from "../pipeline/quien-sos";
import { teamMemberById } from "@/lib/proyectos-team";
import { SPECS, specsOf, specsTxt, normTexto, type SpecKey, type SpecValues } from "@/lib/computos-specs";
import { comprimirImagen } from "@/lib/computos-image";
import { generarPdfComputo } from "@/lib/computos-pdf";
import { PlanoEditor } from "./plano-editor";
import { Historial } from "./historial";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";

// Fase 1 del Generador de Cómputos: Base de luminarias + armado del cómputo
// (buscador, ítems con specs editables, alcance, observaciones, cerrar).
// Quedan para después (Fase 2/3/4, acordado con Ariel): el PDF de cierre, el
// plano interactivo con marcadores, y el historial completo de cómputos
// cerrados. Por eso "cerrar" acá solo cambia el estado — todavía no baja PDF.
//
// Misma identidad "¿Quién sos?" que la pestaña Proyectos (useQuienSos de
// ../pipeline/quien-sos): en el original es una sola variable global
// (currentUser) compartida por TODAS las pestañas del tablero, no una por
// feature — se reusa el mismo hook/localStorage a propósito, no se duplica.
//
// Dos colecciones Firestore reales, calcadas de cgSaveLum/cgSaveComp:
// "luminarias" (la base/catálogo) y "computosGen" (cada cómputo armado).

export type Luminaria = {
  id: string;
  nombre: string;
  codigo?: string;
  img?: string;
  iw?: number;
  ih?: number;
  creado?: string;
  by?: string;
  ts?: number;
} & SpecValues;

export type ComputoItem = {
  uid: string;
  lumId: string;
  nombre: string;
  codigo: string;
  cant: number;
  comentario?: string;
} & SpecValues;

export type ComputoDoc = {
  id: string;
  proyecto: string;
  creado: string;
  items: ComputoItem[];
  estado: "abierto" | "cerrado";
  by: string;
  ts: number;
  cerrado?: string;
  cerradoPor?: string;
  mo?: "si" | "no" | "";
  moEsp?: string;
  elev?: "si" | "no" | "";
  elevEsp?: string;
  obs?: string;
  plano?: { fileId: string; name: string; w: number; h: number; subido?: string };
  marcas?: { u: string; x: number; y: number }[];
  reaperturas?: { ts: number; by: string; cerradoAntes: string }[];
  basadoEn?: string;
};

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtFecha(iso?: string): string {
  if (!iso) return "sin fecha";
  const p = String(iso).split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return String(iso);
}

function Thumb({ l, size }: { l: { img?: string } | null | undefined; size: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted"
      style={{ width: size, height: size }}
    >
      {l?.img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={l.img} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}

function SpecInput({ spec, value, onChange }: { spec: (typeof SPECS)[number]; value: string; onChange: (v: string) => void }) {
  const listId = `cg-dl-${spec.k}`;
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{spec.label}</Label>
      <Input
        list={spec.opts.length ? listId : undefined}
        value={value}
        placeholder={spec.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs"
      />
      {spec.opts.length > 0 && (
        <datalist id={listId}>
          {spec.opts.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </div>
  );
}

// ───────────────────────── Base de luminarias ─────────────────────────

function LuminariaForm({
  luminaria,
  nombreInicial,
  quienSos,
  onSaved,
  onDone,
}: {
  luminaria: Luminaria | null;
  nombreInicial?: string;
  quienSos: string;
  onSaved: (l: Luminaria) => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState(luminaria?.nombre ?? nombreInicial ?? "");
  const [codigo, setCodigo] = useState(luminaria?.codigo ?? "");
  const [specs, setSpecs] = useState<SpecValues>(specsOf(luminaria ?? undefined));
  const [img, setImg] = useState<{ img: string; iw: number; ih: number } | null>(
    luminaria?.img ? { img: luminaria.img, iw: luminaria.iw ?? 0, ih: luminaria.ih ?? 0 } : null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await comprimirImagen(file);
    if (!res) {
      toast.error("No se pudo leer la imagen. Probá con JPG o PNG.");
      return;
    }
    setImg(res);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("Falta el nombre.");
      return;
    }
    setSaving(true);
    try {
      const ref = luminaria ? doc(dbProyectos, "luminarias", luminaria.id) : doc(collection(dbProyectos, "luminarias"));
      const data: Luminaria = {
        id: ref.id,
        nombre: nombre.trim(),
        // String vacío, no undefined — Firestore rechaza `undefined` en un
        // setDoc sin merge (bug real: cargar una luminaria sin código tiraba
        // error antes de este fix).
        codigo: codigo.trim() || "",
        ...specsOf(specs),
        creado: luminaria?.creado ?? hoy(),
        by: luminaria?.by ?? quienSos,
        ts: Date.now(),
        ...(img ? { img: img.img, iw: img.iw, ih: img.ih } : {}),
      };
      await setDoc(ref, data);
      logActivity(
        `${luminaria ? "edito" : "cargo"} la luminaria ${data.nombre}${data.codigo ? ` (${data.codigo})` : ""}`,
        "Generador de computos",
        quienSos
      );
      toast.success(luminaria ? "Luminaria actualizada." : "Luminaria cargada.");
      onSaved(data);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!luminaria) return;
    if (!confirm("¿Eliminar esta luminaria de la base? Los cómputos ya hechos no se modifican.")) return;
    try {
      await deleteDoc(doc(dbProyectos, "luminarias", luminaria.id));
      toast.success("Luminaria eliminada.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Thumb l={img} size={64} />
        <div className="flex flex-col gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            {img ? "Cambiar foto" : "Agregar foto"}
          </Button>
          {img && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={() => {
                setImg(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Quitar foto
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lm-nombre">Nombre</Label>
          <Input id="lm-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la luminaria" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lm-codigo">Código (opcional)</Label>
          <Input id="lm-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SPECS.map((s) => (
          <SpecInput key={s.k} spec={s} value={specs[s.k] ?? ""} onChange={(v) => setSpecs((prev) => ({ ...prev, [s.k]: v }))} />
        ))}
      </div>
      <div className="flex justify-between gap-2">
        <div>
          {luminaria && (
            <Button type="button" variant="delete" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function BaseLuminarias({ luminarias, quienSos }: { luminarias: Luminaria[]; quienSos: string }) {
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Luminaria | null | undefined>(undefined);

  const filtradas = useMemo(() => {
    const q = normTexto(busqueda.trim());
    return luminarias
      .filter((l) => !q || normTexto(`${l.nombre} ${l.codigo ?? ""} ${specsTxt(l)}`).includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [luminarias, busqueda]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en la base por nombre o código..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => setEditando(null)}>
          <Plus className="h-4 w-4" />
          Nueva luminaria
        </Button>
      </div>

      {filtradas.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          {busqueda ? "No hay luminarias que coincidan." : 'La base está vacía. Cargá la primera con "Nueva luminaria".'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtradas.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setEditando(l)}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center hover:border-primary/50"
            >
              <Thumb l={l} size={72} />
              <div className="text-xs font-medium">{l.nombre}</div>
              <div className="text-[11px] text-muted-foreground">{l.codigo || "sin código"}</div>
              {specsTxt(l) && <div className="text-[10px] text-muted-foreground">{specsTxt(l)}</div>}
            </button>
          ))}
        </div>
      )}

      <Dialog
        open={editando !== undefined}
        onOpenChange={(v) => !v && setEditando(undefined)}
        title={editando ? "Editar luminaria" : "Nueva luminaria"}
        className="max-w-lg"
      >
        {editando !== undefined && (
          <LuminariaForm
            luminaria={editando}
            quienSos={quienSos}
            onSaved={() => {}}
            onDone={() => setEditando(undefined)}
          />
        )}
      </Dialog>
    </div>
  );
}

// ───────────────────────── Cómputo (armado) ─────────────────────────

function BuscadorLuminaria({
  luminarias,
  onElegir,
  onCargarNueva,
}: {
  luminarias: Luminaria[];
  onElegir: (l: Luminaria) => void;
  onCargarNueva: (nombre: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [open, setOpen] = useState(false);

  const resultados = useMemo(() => {
    const q = normTexto(texto.trim());
    if (!q) return [];
    const palabras = q.split(/\s+/);
    return luminarias
      .filter((l) => {
        const h = normTexto(`${l.nombre} ${l.codigo ?? ""} ${specsTxt(l)}`);
        return palabras.every((w) => h.includes(w));
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .slice(0, 8);
  }, [luminarias, texto]);

  return (
    <div className="relative">
      <Input
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setOpen(true);
        }}
        onFocus={() => texto && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Buscá la luminaria por nombre o código..."
      />
      {open && texto.trim() && (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {resultados.map((l) => (
            <div
              key={l.id}
              className="flex cursor-pointer items-center gap-2 p-2 hover:bg-muted"
              onMouseDown={(e) => {
                e.preventDefault();
                setTexto(`${l.nombre}${l.codigo ? ` - ${l.codigo}` : ""}`);
                setOpen(false);
                onElegir(l);
              }}
            >
              <Thumb l={l} size={34} />
              <div className="text-xs">
                <div className="font-medium">{l.nombre}</div>
                <div className="text-muted-foreground">{l.codigo || "sin código"}</div>
                {specsTxt(l) && <div className="text-muted-foreground">{specsTxt(l)}</div>}
              </div>
            </div>
          ))}
          <div
            className="flex cursor-pointer items-center gap-2 p-2 text-xs text-primary hover:bg-muted"
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
              onCargarNueva(texto.trim());
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            {resultados.length ? "No es ninguna: " : "No está en la base: "}cargar &quot;{texto.trim()}&quot; como luminaria nueva
          </div>
        </div>
      )}
    </div>
  );
}

function ItemsTable({
  items,
  luminarias,
  onUpdate,
  onDelete,
}: {
  items: ComputoItem[];
  luminarias: Luminaria[];
  onUpdate: (uid: string, patch: Partial<ComputoItem>) => void;
  onDelete: (uid: string) => void;
}) {
  const total = items.reduce((s, it) => s + (Number(it.cant) || 0), 0);
  if (items.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">Todavía no agregaste luminarias. Buscá arriba, elegila y poné la cantidad.</p>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border">
      {items.map((it, idx) => (
        <div key={it.uid} className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0 sm:flex-row sm:items-start">
          <div className="flex items-center gap-2 sm:w-48 sm:shrink-0">
            <span className="w-5 shrink-0 text-xs text-muted-foreground">{idx + 1}</span>
            <Thumb l={luminarias.find((l) => l.id === it.lumId) ?? null} size={40} />
            <div className="text-xs">
              <div className="font-medium">{it.nombre}</div>
              <div className="text-muted-foreground">{it.codigo || "-"}</div>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {SPECS.map((s) => (
              <Input
                key={s.k}
                value={it[s.k] ?? ""}
                placeholder={s.label}
                title={s.label}
                onChange={(e) => onUpdate(it.uid, { [s.k]: e.target.value } as Partial<ComputoItem>)}
                className="h-8 text-xs"
              />
            ))}
          </div>
          <Input
            value={it.comentario ?? ""}
            placeholder="Comentario..."
            onChange={(e) => onUpdate(it.uid, { comentario: e.target.value })}
            className="h-8 text-xs sm:w-40"
          />
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={it.cant}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (v && v > 0) onUpdate(it.uid, { cant: v });
              }}
              className="h-8 w-20 text-xs"
            />
            <Button size="sm" variant="delete" className="h-8 w-8 shrink-0 p-0" title="Quitar" onClick={() => onDelete(it.uid)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between p-3 text-sm font-medium">
        <span>Total luminarias ({items.length} tipos)</span>
        <span>{total}</span>
      </div>
    </div>
  );
}

function AlcanceCard({
  titulo,
  valor,
  especificacion,
  placeholder,
  onChange,
  onChangeEsp,
}: {
  titulo: string;
  valor?: "si" | "no" | "";
  especificacion?: string;
  placeholder: string;
  onChange: (v: "si" | "no" | "") => void;
  onChangeEsp: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">{titulo}</span>
        <div className="flex gap-1">
          <Button size="sm" variant={valor === "si" ? "default" : "outline"} onClick={() => onChange(valor === "si" ? "" : "si")}>
            Sí
          </Button>
          <Button size="sm" variant={valor === "no" ? "default" : "outline"} onClick={() => onChange(valor === "no" ? "" : "no")}>
            No
          </Button>
        </div>
      </div>
      {valor === "si" && (
        <Textarea
          rows={2}
          defaultValue={especificacion ?? ""}
          placeholder={placeholder}
          onBlur={(e) => onChangeEsp(e.target.value)}
        />
      )}
    </div>
  );
}

function ComputoStart({
  abiertos,
  onEmpezar,
  onContinuar,
}: {
  abiertos: ComputoDoc[];
  onEmpezar: (nombre: string) => void;
  onContinuar: (id: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Nuevo cómputo de luminarias</h2>
        <p className="text-sm text-muted-foreground">Elegí o escribí el proyecto/cliente para empezar.</p>
      </div>
      <div className="flex gap-2">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Proyecto / cliente (ej: Club Atlético Platense)"
          onKeyDown={(e) => {
            if (e.key === "Enter" && nombre.trim()) onEmpezar(nombre.trim());
          }}
        />
        <Button
          onClick={() => {
            if (nombre.trim()) onEmpezar(nombre.trim());
          }}
        >
          Empezar cómputo
        </Button>
      </div>
      {abiertos.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Cómputos sin cerrar</h3>
          {abiertos
            .slice()
            .sort((a, b) => (b.ts || 0) - (a.ts || 0))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onContinuar(c.id)}
                className="flex items-center justify-between rounded-md border border-border p-3 text-left text-sm hover:border-primary/50"
              >
                <span className="font-medium">{c.proyecto}</span>
                <span className="text-xs text-muted-foreground">
                  {c.items.length} ítems · {fmtFecha(c.creado)} · {teamMemberById(c.by)?.name ?? ""}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function ComputoWorking({
  computo,
  luminarias,
  quienSos,
  onSalir,
}: {
  computo: ComputoDoc;
  luminarias: Luminaria[];
  quienSos: string;
  onSalir: () => void;
}) {
  const [elegida, setElegida] = useState<Luminaria | null>(null);
  const [especsSel, setEspecsSel] = useState<SpecValues>({});
  const [comentarioSel, setComentarioSel] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [cargandoNueva, setCargandoNueva] = useState<string | null>(null);

  // Partial<ComputoDoc> no alcanza para el patch del plano: para borrarlo
  // hace falta el sentinel deleteField() de Firestore (un merge con
  // `undefined` directo lo rechaza), así que el tipo acepta cualquier
  // Record para ese caso puntual.
  async function guardar(patch: Partial<ComputoDoc> | Record<string, unknown>) {
    await setDoc(doc(dbProyectos, "computosGen", computo.id), { ...patch, ts: Date.now() }, { merge: true });
  }

  function elegir(l: Luminaria) {
    setElegida(l);
    setEspecsSel(specsOf(l));
    setComentarioSel("");
    setCantidad(1);
  }

  async function agregar() {
    if (!elegida) return;
    if (!cantidad || cantidad < 1) return;
    const key = `${SPECS.map((s) => normTexto(especsSel[s.k] ?? "").trim()).join("|")}|${normTexto(comentarioSel)}`;
    const existente = computo.items.find((it) => {
      if (it.lumId !== elegida.id) return false;
      const k = `${SPECS.map((s) => normTexto(it[s.k] ?? "").trim()).join("|")}|${normTexto(it.comentario ?? "")}`;
      return k === key;
    });
    let items: ComputoItem[];
    if (existente) {
      items = computo.items.map((it) => (it.uid === existente.uid ? { ...it, cant: (Number(it.cant) || 0) + cantidad } : it));
    } else {
      const nuevo: ComputoItem = {
        uid: doc(collection(dbProyectos, "tmp")).id,
        lumId: elegida.id,
        nombre: elegida.nombre,
        codigo: elegida.codigo || "",
        cant: cantidad,
        comentario: comentarioSel,
        ...specsOf(especsSel),
      };
      items = [...computo.items, nuevo];
    }
    await guardar({ items });
    setElegida(null);
    setEspecsSel({});
    setComentarioSel("");
    setCantidad(1);
  }

  function actualizarItem(uid: string, patch: Partial<ComputoItem>) {
    const items = computo.items.map((it) => (it.uid === uid ? { ...it, ...patch } : it));
    void guardar({ items });
  }

  function borrarItem(uid: string) {
    const items = computo.items.filter((it) => it.uid !== uid);
    void guardar({ items });
  }

  const [cerrando, setCerrando] = useState(false);

  async function cerrar() {
    if (computo.items.length === 0) {
      toast.error("Agregá al menos una luminaria antes de cerrar el cómputo.");
      return;
    }
    if (!confirm(`¿Cerrar el cómputo de "${computo.proyecto}" y descargar el PDF?`)) return;
    setCerrando(true);
    try {
      const cerradoDoc: ComputoDoc = { ...computo, estado: "cerrado", cerrado: hoy(), cerradoPor: quienSos };
      await guardar({ estado: "cerrado", cerrado: cerradoDoc.cerrado, cerradoPor: cerradoDoc.cerradoPor });
      logActivity("cerro un computo de luminarias", computo.proyecto, quienSos);
      await generarPdfComputo(cerradoDoc, luminarias);
      toast.success("Cómputo cerrado y PDF descargado.");
      onSalir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">{computo.proyecto}</h2>
          <p className="text-xs text-muted-foreground">
            Empezado el {fmtFecha(computo.creado)} por {teamMemberById(computo.by)?.name ?? "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSalir} disabled={cerrando}>
            Salir sin cerrar
          </Button>
          <Button onClick={cerrar} disabled={cerrando}>
            {cerrando ? "Generando PDF..." : "Cerrar cómputo y descargar PDF"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <BuscadorLuminaria luminarias={luminarias} onElegir={elegir} onCargarNueva={(nombre) => setCargandoNueva(nombre)} />
          </div>
          <Input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(parseInt(e.target.value, 10) || 1)}
            onKeyDown={(e) => e.key === "Enter" && agregar()}
            className="w-24"
            placeholder="Cant."
          />
          <Button onClick={agregar} disabled={!elegida}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>

        {elegida && (
          <div className="flex flex-col gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Thumb l={elegida} size={44} />
              <div className="text-sm">
                <div className="font-medium">{elegida.nombre}</div>
                <div className="text-xs text-muted-foreground">{elegida.codigo || "sin código"}</div>
              </div>
              <span className="ml-auto text-xs text-muted-foreground">Poné la cantidad y Enter</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {SPECS.map((s) => (
                <SpecInput
                  key={s.k}
                  spec={s}
                  value={especsSel[s.k] ?? ""}
                  onChange={(v) => setEspecsSel((prev) => ({ ...prev, [s.k]: v }))}
                />
              ))}
            </div>
            <Input
              value={comentarioSel}
              onChange={(e) => setComentarioSel(e.target.value)}
              placeholder="Comentario (opcional) — ej: para tribuna norte, con visera antideslumbrante..."
              onKeyDown={(e) => e.key === "Enter" && agregar()}
            />
            <p className="text-xs text-muted-foreground">
              Si en este proyecto varía algún dato (otro ángulo, otra temperatura...), cambialo acá antes de agregar: queda como fila
              aparte.
            </p>
          </div>
        )}
      </div>

      <ItemsTable items={computo.items} luminarias={luminarias} onUpdate={actualizarItem} onDelete={borrarItem} />

      <PlanoEditor computo={computo} onUpdate={guardar} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AlcanceCard
          titulo="Incluye mano de obra"
          valor={computo.mo}
          especificacion={computo.moEsp}
          placeholder="Especificación de tareas incluidas (montaje, cableado, conexionado, puesta en marcha, retiro de lo existente...)"
          onChange={(v) => void guardar({ mo: v })}
          onChangeEsp={(v) => void guardar({ moEsp: v })}
        />
        <AlcanceCard
          titulo="Necesita elevador"
          valor={computo.elev}
          especificacion={computo.elevEsp}
          placeholder="Especificación del elevador (tipo, altura de trabajo, días estimados, quién lo provee...)"
          onChange={(v) => void guardar({ elev: v })}
          onChangeEsp={(v) => void guardar({ elevEsp: v })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Observaciones generales del cómputo</Label>
        <Textarea
          rows={3}
          defaultValue={computo.obs ?? ""}
          placeholder="Comentarios para todo el cómputo (van a salir en el PDF)..."
          onBlur={(e) => void guardar({ obs: e.target.value })}
        />
      </div>

      <Dialog open={cargandoNueva !== null} onOpenChange={(v) => !v && setCargandoNueva(null)} title="Nueva luminaria" className="max-w-lg">
        {cargandoNueva !== null && (
          <LuminariaForm
            luminaria={null}
            nombreInicial={cargandoNueva}
            quienSos={quienSos}
            onSaved={(l) => elegir(l)}
            onDone={() => setCargandoNueva(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

// ───────────────────────── Principal ─────────────────────────

export function ComputosClient() {
  const [luminarias, setLuminarias] = useState<Luminaria[] | null>(null);
  const [computos, setComputos] = useState<ComputoDoc[] | null>(null);
  const [tab, setTab] = useState<"computo" | "base" | "historial">("computo");
  const [curId, setCurId] = useState<string | null>(null);
  const { quienSos, elegir } = useQuienSos();

  useEffect(() => {
    const unsub = onSnapshot(
      collection(dbProyectos, "luminarias"),
      (snap) => setLuminarias(snap.docs.map((d) => d.data() as Luminaria)),
      (err) => {
        console.error(err);
        toast.error("No se pudo conectar con la base de luminarias.");
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(dbProyectos, "computosGen"),
      (snap) => setComputos(snap.docs.map((d) => d.data() as ComputoDoc)),
      (err) => {
        console.error(err);
        toast.error("No se pudo conectar con los cómputos.");
      }
    );
    return () => unsub();
  }, []);

  const curComputo = useMemo(() => computos?.find((c) => c.id === curId) ?? null, [computos, curId]);

  if (!quienSos) {
    return <QuienSos onElegir={elegir} />;
  }

  if (luminarias === null || computos === null) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  async function empezar(nombre: string) {
    const ref = doc(collection(dbProyectos, "computosGen"));
    const nuevo: ComputoDoc = {
      id: ref.id,
      proyecto: nombre,
      creado: hoy(),
      items: [],
      estado: "abierto",
      by: quienSos as string,
      ts: Date.now(),
    };
    await setDoc(ref, nuevo);
    logActivity("empezo un computo de luminarias", nombre, quienSos as string);
    setCurId(ref.id);
  }

  const abiertos = computos.filter((c) => c.estado !== "cerrado");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant={tab === "computo" ? "default" : "outline"}
          onClick={() => {
            setTab("computo");
          }}
        >
          Cómputo
        </Button>
        <Button size="sm" variant={tab === "base" ? "default" : "outline"} onClick={() => setTab("base")}>
          Base de luminarias
        </Button>
        <Button size="sm" variant={tab === "historial" ? "default" : "outline"} onClick={() => setTab("historial")}>
          Historial
        </Button>
      </div>

      {tab === "base" ? (
        <BaseLuminarias luminarias={luminarias} quienSos={quienSos} />
      ) : tab === "historial" ? (
        <Historial
          computos={computos}
          luminarias={luminarias}
          quienSos={quienSos}
          onAbrir={(id) => {
            setCurId(id);
            setTab("computo");
          }}
        />
      ) : curComputo && curComputo.estado !== "cerrado" ? (
        <ComputoWorking computo={curComputo} luminarias={luminarias} quienSos={quienSos} onSalir={() => setCurId(null)} />
      ) : (
        <ComputoStart abiertos={abiertos} onEmpezar={empezar} onContinuar={setCurId} />
      )}
    </div>
  );
}
