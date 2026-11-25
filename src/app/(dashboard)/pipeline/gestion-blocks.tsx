"use client";

// Los 6 bloques exclusivos de Gestión de Proyectos (section "gestion") — Port
// de buildGestionBlocks y los bloques que arma: buildSegurosBlock,
// buildAlojamientoBlock, buildContactosGestion, buildChecklistObra,
// buildGanttFileBlock, buildInformesBlock (líneas 3415-3703 del original).
//
// Diferencia a propósito con el original: ahí el checklist de Seguros salía
// de un array EMPLEADOS hardcodeado (6 personas con DNI y nacimiento fijos
// en el código, desconectado de cualquier colección). Acá sale de Employee
// (Mongo) — decisión explícita de Ariel (2026-11-25): si falta alguien se
// carga en Empleados, no en este módulo. "Otras personas" (subcontratistas,
// gente que no es empleado de ITELSA) se mantiene igual que el original.
import { useState } from "react";
import { toast } from "sonner";
import { doc, setDoc, getDoc, deleteDoc, collection } from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { Plus, X, Download, Upload, Mail, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logActivity } from "@/lib/proyectos-activity";
import { notificarSeguros } from "@/lib/proyectos-notify";
import type {
  ProyectoDoc,
  Seguros,
  SeguroOtro,
  Alojamiento,
  ContactoObra,
  ChecklistObraItem,
  Informe,
  EmpleadoOption,
} from "./pipeline-client";

type UpdateFn = (patch: Partial<ProyectoDoc>) => Promise<void>;

const GFILE_MAX = 700 * 1024; // Firestore admite ~1 MB por doc; en base64 el archivo crece un tercio

function fmtFecha(iso?: string): string {
  if (!iso) return "sin fecha";
  const p = String(iso).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso);
}
function hoyISO(): string {
  const d = new Date();
  const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function nid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Seguros ──
export function SegurosBlock({
  proyecto,
  empleados,
  isFin,
  quienSos,
  onUpdate,
}: {
  proyecto: ProyectoDoc;
  empleados: EmpleadoOption[];
  isFin: boolean;
  quienSos: string;
  onUpdate: UpdateFn;
}) {
  const s: Seguros = proyecto.seguros ?? {};
  const enviado = !!s.enviado;
  const lock = isFin || enviado; // una vez enviada la solicitud, los datos quedan fijos (destildar para editar)
  const sel = s.empleados ?? [];
  const otros = s.otros ?? [];

  function personasTildadas(): { nombre: string; dni?: string; nac?: string }[] {
    const out: { nombre: string; dni?: string; nac?: string }[] = [];
    empleados.forEach((e) => {
      if (sel.includes(e.id)) out.push({ nombre: `${e.nombre} ${e.apellido}`.trim(), dni: e.dni, nac: e.nac });
    });
    otros.forEach((o) => {
      if (o.nombre && o.nombre.trim()) out.push(o);
    });
    return out;
  }

  async function toggleEmpleado(id: string) {
    const arr = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    await onUpdate({ seguros: { ...s, empleados: arr } });
  }
  async function updOtro(idx: number, field: keyof SeguroOtro, value: string) {
    const next = otros.map((o, i) => (i === idx ? { ...o, [field]: value } : o));
    await onUpdate({ seguros: { ...s, otros: next } });
  }
  async function addOtro() {
    await onUpdate({ seguros: { ...s, otros: [...otros, { id: nid("sg"), nombre: "", dni: "", nac: "" }] } });
  }
  async function delOtro(idx: number) {
    await onUpdate({ seguros: { ...s, otros: otros.filter((_, i) => i !== idx) } });
  }
  async function enviar() {
    if (enviado) {
      if (!confirm("Destildar permite editar los datos y volver a enviar la solicitud. ¿Continuar?")) return;
      await onUpdate({ seguros: { ...s, enviado: false } });
      return;
    }
    const personas = personasTildadas();
    if (!personas.length) {
      toast.error("Tildá al menos una persona que necesite seguro.");
      return;
    }
    if (!confirm(`Se va a enviar un mail a admin@itelsasas.com con los datos de ${personas.length} persona(s). ¿Enviar?`)) return;
    notificarSeguros(proyecto, personas, quienSos);
    await onUpdate({ seguros: { ...s, enviado: true, enviadoTxt: `${new Date().toLocaleString("es-AR")} por vos` } });
    logActivity("envio la solicitud de seguros a administracion", proyecto.name, quienSos);
    toast.success("Solicitud enviada a administración.");
  }
  async function toggleSacados() {
    await onUpdate({ seguros: { ...s, sacados: !s.sacados } });
    logActivity(!s.sacados ? "marco los seguros como sacados" : "desmarco los seguros sacados", proyecto.name, quienSos);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold">Seguros</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Tildá quiénes necesitan seguro para esta obra y completá el tipo de seguro.
      </p>
      {empleados.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay empleados activos cargados.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {empleados.map((e) => {
            const on = sel.includes(e.id);
            return (
              <button
                key={e.id}
                type="button"
                disabled={lock}
                onClick={() => toggleEmpleado(e.id)}
                className={`flex items-center justify-between rounded-md border px-3 py-1.5 text-left text-sm transition-colors ${
                  on ? "border-primary/40 bg-primary/5" : "border-border"
                } ${lock ? "cursor-default opacity-80" : "hover:bg-muted"}`}
              >
                <span>{e.nombre} {e.apellido}</span>
                <span className="text-xs text-muted-foreground">DNI {e.dni || "sin cargar"}</span>
              </button>
            );
          })}
        </div>
      )}

      {otros.length > 0 && <p className="mb-1 mt-3 text-xs font-medium text-muted-foreground">Otras personas</p>}
      <div className="flex flex-col gap-2">
        {otros.map((o, idx) => (
          <div key={o.id} className="flex flex-wrap items-center gap-2">
            <Input className="h-9 min-w-[160px] flex-1" placeholder="Nombre completo" value={o.nombre} disabled={lock} onChange={(e) => updOtro(idx, "nombre", e.target.value)} />
            <Input className="h-9 w-32" placeholder="DNI" value={o.dni ?? ""} disabled={lock} onChange={(e) => updOtro(idx, "dni", e.target.value)} />
            <Input className="h-9 w-40" type="date" title="Fecha de nacimiento" value={o.nac ?? ""} disabled={lock} onChange={(e) => updOtro(idx, "nac", e.target.value)} />
            {!lock && (
              <Button variant="delete" size="sm" className="h-9 w-9 p-0" title="Quitar" onClick={() => delOtro(idx)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!lock && (
        <Button variant="outline" size="sm" className="mt-2" onClick={addOtro}>
          <Plus className="h-3.5 w-3.5" /> Agregar otra persona
        </Button>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Cobertura desde</label>
          <Input type="date" value={s.desde ?? proyecto.start ?? ""} disabled={lock} onChange={(e) => onUpdate({ seguros: { ...s, desde: e.target.value } })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Cobertura hasta</label>
          <Input type="date" value={s.hasta ?? proyecto.end ?? ""} disabled={lock} onChange={(e) => onUpdate({ seguros: { ...s, hasta: e.target.value } })} />
        </div>
      </div>

      <label className="mb-1 mt-3 block text-xs text-muted-foreground">Tipo de seguro y datos extra</label>
      <Textarea
        key={proyecto.id}
        rows={3}
        defaultValue={s.datos ?? ""}
        placeholder="Ej: Altura 45 metros. Tareas de mantenimiento de luminarias. Cláusula de no repetición a favor de ..."
        disabled={lock}
        onBlur={(e) => onUpdate({ seguros: { ...s, datos: e.target.value } })}
      />

      <button
        type="button"
        disabled={isFin}
        onClick={enviar}
        className={`mt-3 flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${
          enviado ? "border-success/40 bg-success/5" : "border-border hover:bg-muted/50"
        } disabled:cursor-default disabled:opacity-70`}
      >
        <span>
          {enviado
            ? `Solicitud enviada a administración (admin@itelsasas.com)${s.enviadoTxt ? ` — ${s.enviadoTxt}` : ""}`
            : "Solicitud lista: enviar datos a administración (admin@itelsasas.com)"}
        </span>
        <Mail className="h-4 w-4 shrink-0 text-primary" />
      </button>

      <button
        type="button"
        disabled={isFin}
        onClick={toggleSacados}
        className="mt-2 w-full rounded-md border border-border px-3 py-1.5 text-left text-sm hover:bg-muted/50 disabled:cursor-default disabled:opacity-70"
      >
        {s.sacados ? <Badge variant="success">Seguros sacados</Badge> : "Marcar seguros como sacados"}
      </button>
    </div>
  );
}

// ── Alojamiento ──
export function AlojamientoBlock({ proyecto, isFin, onUpdate }: { proyecto: ProyectoDoc; isFin: boolean; onUpdate: UpdateFn }) {
  const a: Alojamiento = proyecto.alojamiento ?? {};
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Alojamiento</h2>
      <label className="mb-1 block text-xs text-muted-foreground">Link del alojamiento</label>
      <Input type="url" placeholder="https://..." value={a.link ?? ""} disabled={isFin} onChange={(e) => onUpdate({ alojamiento: { ...a, link: e.target.value } })} />
      {a.link && (
        <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" /> Abrir alojamiento
        </a>
      )}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Ingreso</label>
          <Input type="date" value={a.desde ?? ""} disabled={isFin} onChange={(e) => onUpdate({ alojamiento: { ...a, desde: e.target.value } })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Salida</label>
          <Input type="date" value={a.hasta ?? ""} disabled={isFin} onChange={(e) => onUpdate({ alojamiento: { ...a, hasta: e.target.value } })} />
        </div>
      </div>
      <button
        type="button"
        disabled={isFin}
        onClick={() => onUpdate({ alojamiento: { ...a, reservado: !a.reservado } })}
        className="mt-3 w-full rounded-md border border-border px-3 py-1.5 text-left text-sm hover:bg-muted/50 disabled:cursor-default disabled:opacity-70"
      >
        {a.reservado ? <Badge variant="success">Alojamiento reservado</Badge> : "Marcar alojamiento como reservado"}
      </button>
    </div>
  );
}

// ── Contactos de obra ──
export function ContactosObraBlock({ proyecto, isFin, onUpdate }: { proyecto: ProyectoDoc; isFin: boolean; onUpdate: UpdateFn }) {
  const list = proyecto.contactosObra ?? [];
  function patch(next: ContactoObra[]) {
    void onUpdate({ contactosObra: next });
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Contactos de obra</h2>
      {list.length === 0 && <p className="text-xs text-muted-foreground">Sin contactos cargados.</p>}
      <div className="flex flex-col gap-2">
        {list.map((ct, idx) => (
          <div key={ct.id} className="flex flex-wrap items-center gap-2">
            <Input className="h-9 min-w-[140px] flex-1" placeholder="Nombre" value={ct.nombre} disabled={isFin} onChange={(e) => patch(list.map((x, i) => (i === idx ? { ...x, nombre: e.target.value } : x)))} />
            <Input className="h-9 min-w-[140px] flex-1" placeholder="Apellido / rol" value={ct.apellido ?? ""} disabled={isFin} onChange={(e) => patch(list.map((x, i) => (i === idx ? { ...x, apellido: e.target.value } : x)))} />
            <Input className="h-9 w-36" placeholder="Teléfono" value={ct.telefono ?? ""} disabled={isFin} onChange={(e) => patch(list.map((x, i) => (i === idx ? { ...x, telefono: e.target.value } : x)))} />
            {!isFin && (
              <Button variant="delete" size="sm" className="h-9 w-9 p-0" title="Quitar" onClick={() => patch(list.filter((_, i) => i !== idx))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!isFin && (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => patch([...list, { id: nid("ct"), nombre: "", apellido: "", telefono: "" }])}>
          <Plus className="h-3.5 w-3.5" /> Agregar contacto
        </Button>
      )}
    </div>
  );
}

// ── Checklist de obra ──
export function ChecklistObraBlock({ proyecto, isFin, onUpdate }: { proyecto: ProyectoDoc; isFin: boolean; onUpdate: UpdateFn }) {
  const list = proyecto.checkObra ?? [];
  function patch(next: ChecklistObraItem[]) {
    void onUpdate({ checkObra: next });
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold">Checklist de obra</h2>
      <p className="mb-3 text-xs text-muted-foreground">Marcá cada cuestión como necesaria y, cuando esté hecha, como realizada.</p>
      {list.length === 0 && <p className="text-xs text-muted-foreground">Sin ítems todavía.</p>}
      <div className="flex flex-col gap-2">
        {list.map((it, idx) => (
          <div key={it.id} className={`flex flex-wrap items-center gap-2 rounded-md border p-2 ${it.realizado ? "border-success/40 bg-success/5" : "border-border"}`}>
            <Input className="h-9 min-w-[180px] flex-1" placeholder="Ej: Permiso de ingreso, elevador, EPP..." value={it.texto} disabled={isFin} onChange={(e) => patch(list.map((x, i) => (i === idx ? { ...x, texto: e.target.value } : x)))} />
            <Button size="sm" variant={it.necesario ? "default" : "outline"} disabled={isFin} onClick={() => patch(list.map((x, i) => (i === idx ? { ...x, necesario: !x.necesario } : x)))}>
              Necesario
            </Button>
            <Button size="sm" variant={it.realizado ? "default" : "outline"} disabled={isFin} onClick={() => patch(list.map((x, i) => (i === idx ? { ...x, realizado: !x.realizado } : x)))}>
              Realizado
            </Button>
            {!isFin && (
              <Button variant="delete" size="sm" className="h-9 w-9 p-0" title="Quitar" onClick={() => patch(list.filter((_, i) => i !== idx))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!isFin && (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => patch([...list, { id: nid("ck"), texto: "", necesario: true, realizado: false }])}>
          <Plus className="h-3.5 w-3.5" /> Agregar ítem
        </Button>
      )}
    </div>
  );
}

// ── Diagrama de Gantt de la obra (archivo en "gfiles", igual colección que
// el plano de Cómputos — ver plano-editor.tsx — pero con projId/tipo:"gantt"
// en vez de compId/tipo:"plano") ──
export function GanttFileBlock({ proyecto, isFin, quienSos, onUpdate }: { proyecto: ProyectoDoc; isFin: boolean; quienSos: string; onUpdate: UpdateFn }) {
  const [subiendo, setSubiendo] = useState(false);
  const gf = proyecto.ganttFile;

  async function subir(file: File) {
    if (file.size > GFILE_MAX) {
      toast.error(`El archivo pesa ${Math.round(file.size / 1024)} KB y el máximo es 700 KB. Subilo a Dropbox/Drive y pegá el link abajo.`);
      return;
    }
    setSubiendo(true);
    try {
      const reader = new FileReader();
      const data: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const oldId = gf?.fileId;
      const fid = doc(collection(dbProyectos, "gfiles")).id;
      await setDoc(doc(dbProyectos, "gfiles", fid), {
        id: fid,
        projId: proyecto.id,
        tipo: "gantt",
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        data,
      });
      await onUpdate({ ganttFile: { fileId: fid, name: file.name, size: file.size, subido: new Date().toLocaleString("es-AR") } });
      logActivity("subio el diagrama de Gantt", proyecto.name, quienSos);
      if (oldId) void deleteDoc(doc(dbProyectos, "gfiles", oldId));
      toast.success("Archivo cargado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    } finally {
      setSubiendo(false);
    }
  }

  async function descargar() {
    if (!gf) return;
    try {
      const snap = await getDoc(doc(dbProyectos, "gfiles", gf.fileId));
      if (!snap.exists()) {
        toast.error("No se encontró el archivo.");
        return;
      }
      const d = snap.data() as { data: string; name?: string };
      const a = document.createElement("a");
      a.href = d.data;
      a.download = d.name || gf.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("No se pudo descargar el archivo.");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold">Diagrama de Gantt de la obra</h2>
      <p className="mb-3 text-xs text-muted-foreground">Subí el archivo (hasta 700 KB) o pegá el link si es más pesado.</p>
      {gf && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-border p-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{gf.name}</p>
            <p className="text-xs text-muted-foreground">
              {Math.max(1, Math.round(gf.size / 1024))} KB{gf.subido ? ` — subido ${gf.subido}` : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={descargar}>
            <Download className="h-3.5 w-3.5" /> Descargar
          </Button>
        </div>
      )}
      {!isFin && (
        <label className="inline-block">
          <input
            type="file"
            className="hidden"
            disabled={subiendo}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subir(f);
              e.target.value = "";
            }}
          />
          <span className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted">
            <Upload className="h-3.5 w-3.5" /> {subiendo ? "Subiendo..." : gf ? "Reemplazar archivo" : "Subir archivo de Gantt"}
          </span>
        </label>
      )}
      <div className="mt-3">
        <label className="mb-1 block text-xs text-muted-foreground">o link al archivo</label>
        <Input type="url" placeholder="https://..." value={proyecto.ganttLink ?? ""} disabled={isFin} onChange={(e) => onUpdate({ ganttLink: e.target.value })} />
        {proyecto.ganttLink && (
          <a href={proyecto.ganttLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="h-3 w-3" /> Abrir Gantt
          </a>
        )}
      </div>
    </div>
  );
}

// ── Informes enviados ──
export function InformesBlock({ proyecto, isFin, onUpdate }: { proyecto: ProyectoDoc; isFin: boolean; onUpdate: UpdateFn }) {
  const list = proyecto.informes ?? [];
  function patch(next: Informe[]) {
    void onUpdate({ informes: next });
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Informes enviados</h2>
      {list.length === 0 && <p className="text-xs text-muted-foreground">Sin informes cargados.</p>}
      <div className="flex flex-col gap-2">
        {list.map((inf, idx) => (
          <div key={inf.id} className="flex flex-wrap items-center gap-2">
            <Input className="h-9 min-w-[180px] flex-[3]" placeholder="Nombre del informe" value={inf.nombre} disabled={isFin} onChange={(e) => patch(list.map((x, i) => (i === idx ? { ...x, nombre: e.target.value } : x)))} />
            <Input className="h-9 w-40" type="date" value={inf.fecha ?? ""} disabled={isFin} onChange={(e) => patch(list.map((x, i) => (i === idx ? { ...x, fecha: e.target.value } : x)))} />
            {!isFin && (
              <Button variant="delete" size="sm" className="h-9 w-9 p-0" title="Quitar" onClick={() => patch(list.filter((_, i) => i !== idx))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!isFin && (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => patch([...list, { id: nid("in"), nombre: "", fecha: hoyISO() }])}>
          <Plus className="h-3.5 w-3.5" /> Agregar informe
        </Button>
      )}
    </div>
  );
}
