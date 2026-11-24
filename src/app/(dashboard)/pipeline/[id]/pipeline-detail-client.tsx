"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Send, Trash2 } from "lucide-react";
import { collection, doc, onSnapshot, query, setDoc, deleteDoc, where } from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { TEAM, teamMemberById } from "@/lib/proyectos-team";
import { notificarEstadoFinal, notificarManual } from "@/lib/proyectos-notify";
import { logActivity } from "@/lib/proyectos-activity";
import { useQuienSos, QuienSos } from "../quien-sos";
import {
  TAREA_ESTADOS,
  tareaEstadoLabel,
  PROYECTO_PRIORIDADES,
  prioridadLabel,
  prioridadBadgeVariant,
  proyectoEstadoLabel,
  proyectoEstadoBadgeVariant,
  type ProyectoEstado,
  type ProyectoPrioridad,
  type TareaEstado,
} from "@/lib/proyectos-estados";
import type { ProyectoDoc } from "../pipeline-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";

type TareaDoc = {
  id: string;
  projId: string;
  title: string;
  desc?: string;
  assignee?: string;
  priority: ProyectoPrioridad;
  status: TareaEstado;
  due?: string;
  [key: string]: unknown;
};

const COLUMNAS: { estado: TareaEstado; titulo: string }[] = [
  { estado: "pendiente", titulo: "Pendiente" },
  { estado: "en-curso", titulo: "En curso" },
  { estado: "terminado", titulo: "Terminado" },
];

function TareaForm({
  proyectoId,
  proyectoNombre,
  quienSos,
  onDone,
}: {
  proyectoId: string;
  proyectoNombre: string;
  quienSos: string;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [desc, setDesc] = useState("");
  const [assignee, setAssignee] = useState("");
  const [prioridad, setPrioridad] = useState<ProyectoPrioridad>("media");
  const [due, setDue] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Falta el título de la tarea.");
      return;
    }
    setSaving(true);
    try {
      const ref = doc(collection(dbProyectos, "tasks"));
      const data: TareaDoc = {
        id: ref.id,
        projId: proyectoId,
        title: titulo.trim(),
        desc: desc || undefined,
        assignee: assignee || undefined,
        priority: prioridad,
        status: "pendiente",
        due: due || undefined,
      };
      await setDoc(ref, data);
      logActivity(`agrego una tarea: ${data.title}`, proyectoNombre, quienSos);
      toast.success("Tarea creada.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Qué hay que hacer?" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="desc">Descripción (opcional)</Label>
        <Textarea id="desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assignee">Responsable</Label>
          <Select id="assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Sin asignar</option>
            {TEAM.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prioridad">Prioridad</Label>
          <Select id="prioridad" value={prioridad} onChange={(e) => setPrioridad(e.target.value as ProyectoPrioridad)}>
            {PROYECTO_PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {prioridadLabel(p)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="due">Vencimiento (opcional)</Label>
        <Input id="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Creando..." : "Agregar tarea"}
        </Button>
      </div>
    </form>
  );
}

function TareaCard({
  tarea,
  proyectoNombre,
  quienSos,
}: {
  tarea: TareaDoc;
  proyectoNombre: string;
  quienSos: string;
}) {
  const [busy, setBusy] = useState(false);
  const responsable = tarea.assignee ? teamMemberById(tarea.assignee)?.name : undefined;

  async function cambiarEstado(estado: string) {
    setBusy(true);
    try {
      await setDoc(doc(dbProyectos, "tasks", tarea.id), { status: estado }, { merge: true });
      logActivity(`cambio tarea '${tarea.title}' a ${tareaEstadoLabel(estado as TareaEstado)}`, proyectoNombre, quienSos);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    } finally {
      setBusy(false);
    }
  }

  async function borrar() {
    if (!confirm(`¿Borrar la tarea "${tarea.title}"?`)) return;
    setBusy(true);
    try {
      await deleteDoc(doc(dbProyectos, "tasks", tarea.id));
      toast.success("Tarea borrada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{tarea.title}</p>
        <Button size="sm" variant="delete" className="h-6 w-6 shrink-0 p-0" title="Borrar" disabled={busy} onClick={borrar}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {tarea.desc && <p className="text-xs text-muted-foreground">{tarea.desc}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={prioridadBadgeVariant(tarea.priority)}>{prioridadLabel(tarea.priority)}</Badge>
        {responsable && <span className="text-xs text-muted-foreground">{responsable}</span>}
        {tarea.due && (
          <span className="text-xs text-muted-foreground">vence {new Date(tarea.due).toLocaleDateString("es-AR")}</span>
        )}
      </div>
      <Select value={tarea.status} disabled={busy} onChange={(e) => cambiarEstado(e.target.value)} className="h-8 text-xs">
        {TAREA_ESTADOS.map((estado) => (
          <option key={estado} value={estado}>
            {tareaEstadoLabel(estado)}
          </option>
        ))}
      </Select>
    </div>
  );
}

function NotificarForm({
  proyecto,
  quienSos,
  onDone,
}: {
  proyecto: ProyectoDoc;
  quienSos: string;
  onDone: () => void;
}) {
  const [asunto, setAsunto] = useState(`Novedad en ${proyecto.name}`);
  const [mensaje, setMensaje] = useState("");
  const [otroMail, setOtroMail] = useState("");
  const [incluirResumen, setIncluirResumen] = useState(true);
  const [sending, setSending] = useState(false);

  const destinatarios =
    proyecto.members.length > 0
      ? proyecto.members.map((id) => teamMemberById(id)?.name).filter(Boolean).join(", ")
      : "todo el equipo (el proyecto no tiene miembros asignados)";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!asunto.trim()) {
      toast.error("Falta el asunto.");
      return;
    }
    setSending(true);
    const extra = otroMail
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    try {
      notificarManual(proyecto, asunto.trim(), mensaje, quienSos, extra, incluirResumen);
      logActivity(`envio una notificacion a ${destinatarios}`, proyecto.name, quienSos);
      toast.success("Notificación enviada.");
      onDone();
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">Para: {destinatarios}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="otroMail">Otro mail (opcional, separados por coma)</Label>
        <Input id="otroMail" value={otroMail} onChange={(e) => setOtroMail(e.target.value)} placeholder="nombre@empresa.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asunto">Asunto</Label>
        <Input id="asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mensaje">Mensaje</Label>
        <Textarea id="mensaje" rows={3} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Qué querés avisar?" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={incluirResumen} onChange={(e) => setIncluirResumen(e.target.checked)} />
        Incluir resumen del proyecto (fechas, equipo)
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={sending}>
          {sending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </form>
  );
}

export function PipelineDetailClient({ proyectoId }: { proyectoId: string }) {
  const [proyecto, setProyecto] = useState<ProyectoDoc | null | undefined>(undefined);
  const [tareas, setTareas] = useState<TareaDoc[]>([]);
  const [creandoOpen, setCreandoOpen] = useState(false);
  const [notificarOpen, setNotificarOpen] = useState(false);
  const { quienSos, elegir } = useQuienSos();

  useEffect(() => {
    const unsub = onSnapshot(
      doc(dbProyectos, "projects", proyectoId),
      (snap) => setProyecto(snap.exists() ? (snap.data() as ProyectoDoc) : null),
      (err) => {
        console.error(err);
        toast.error("No se pudo conectar con la base de Proyectos.");
      }
    );
    return () => unsub();
  }, [proyectoId]);

  useEffect(() => {
    const q = query(collection(dbProyectos, "tasks"), where("projId", "==", proyectoId));
    const unsub = onSnapshot(q, (snap) => setTareas(snap.docs.map((d) => d.data() as TareaDoc)));
    return () => unsub();
  }, [proyectoId]);

  async function cambiarEstadoProyecto(estado: ProyectoEstado) {
    if (!proyecto || !quienSos) return;
    const estadoAnterior = proyecto.status;
    try {
      let fechaVenta = proyecto.fechaVenta;
      if (estado === "vendido") {
        fechaVenta = proyecto.fechaVenta ?? new Date().toISOString();
        await setDoc(doc(dbProyectos, "projects", proyecto.id), { status: "vendido", fechaVenta }, { merge: true });
      } else {
        await setDoc(doc(dbProyectos, "projects", proyecto.id), { status: estado }, { merge: true });
      }
      // Igual que en la lista: solo notifica si el estado efectivamente
      // cambió a vendido/finalizado, no en cada edición dentro del mismo estado.
      if (estado !== estadoAnterior && (estado === "vendido" || estado === "finalizado")) {
        notificarEstadoFinal({ ...proyecto, fechaVenta }, estado, quienSos);
      }
      if (estado !== estadoAnterior) {
        logActivity(`cambio el estado del proyecto a ${proyectoEstadoLabel(estado)}`, proyecto.name, quienSos);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    }
  }

  if (proyecto === undefined || quienSos === undefined) {
    return <p className="text-sm text-muted-foreground">Cargando proyecto…</p>;
  }
  if (!quienSos) {
    return <QuienSos onElegir={elegir} />;
  }
  if (proyecto === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Este proyecto no existe o fue borrado.</p>
        <Link href="/pipeline" className="text-sm text-primary hover:underline">
          Volver a Proyectos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/pipeline" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Proyectos
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: proyecto.color }} />
          <h1 className="text-2xl font-semibold">{proyecto.name}</h1>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={proyectoEstadoBadgeVariant(proyecto.status)}>{proyectoEstadoLabel(proyecto.status)}</Badge>
          <Badge variant={prioridadBadgeVariant(proyecto.priority)}>{prioridadLabel(proyecto.priority)}</Badge>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setNotificarOpen(true)}>
            <Send className="h-3.5 w-3.5" />
            Notificar
          </Button>
          <Select
            value={proyecto.status}
            onChange={(e) => cambiarEstadoProyecto(e.target.value as ProyectoEstado)}
            className="h-8 w-40 text-xs"
          >
            <option value="activo">Activo</option>
            <option value="vendido">Vendido</option>
            <option value="finalizado">Finalizado</option>
          </Select>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 md:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Cliente</dt>
            <dd>{proyecto.clienteNombre || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Equipo</dt>
            <dd>
              {proyecto.members.length > 0
                ? proyecto.members.map((id) => teamMemberById(id)?.name).filter(Boolean).join(", ")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Inicio</dt>
            <dd>{proyecto.start ? new Date(proyecto.start).toLocaleDateString("es-AR") : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fin estimado</dt>
            <dd>{proyecto.end ? new Date(proyecto.end).toLocaleDateString("es-AR") : "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setCreandoOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva tarea
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNAS.map((col) => {
          const items = tareas.filter((t) => t.status === col.estado);
          return (
            <div key={col.estado} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{col.titulo}</h2>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.length === 0 && <p className="text-xs text-muted-foreground">Sin tareas en esta columna.</p>}
                {items.map((t) => (
                  <TareaCard key={t.id} tarea={t} proyectoNombre={proyecto.name} quienSos={quienSos} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={creandoOpen} onOpenChange={setCreandoOpen} title="Nueva tarea" className="max-w-lg">
        <TareaForm
          proyectoId={proyecto.id}
          proyectoNombre={proyecto.name}
          quienSos={quienSos}
          onDone={() => setCreandoOpen(false)}
        />
      </Dialog>

      <Dialog open={notificarOpen} onOpenChange={setNotificarOpen} title="Notificar" className="max-w-lg">
        <NotificarForm proyecto={proyecto} quienSos={quienSos} onDone={() => setNotificarOpen(false)} />
      </Dialog>
    </div>
  );
}
