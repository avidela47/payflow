"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  PIPELINE_TAREA_ESTADOS,
  pipelineTareaEstadoLabel,
  pipelineProyectoEstadoLabel,
  pipelineProyectoEstadoBadgeVariant,
  pipelinePrioridadLabel,
  pipelinePrioridadBadgeVariant,
  type PipelineProyectoEstado,
  type PipelineTareaEstado,
  type PipelinePrioridad,
} from "@/lib/pipeline-estados";
import { createPipelineTarea, deletePipelineTarea, updatePipelineTareaEstado } from "../actions";

export type ProyectoDetalle = {
  id: string;
  nombre: string;
  clienteNombre?: string;
  color: string;
  miembros: string[];
  fechaInicioISO?: string;
  fechaFinISO?: string;
  prioridad: PipelinePrioridad;
  estado: PipelineProyectoEstado;
  notas?: string;
};

export type TareaItem = {
  id: string;
  titulo: string;
  descripcion?: string;
  responsable?: string;
  prioridad: PipelinePrioridad;
  estado: PipelineTareaEstado;
  vencimientoISO?: string;
};

export type EmpleadoOption = { id: string; nombre: string };

const COLUMNAS: { estado: PipelineTareaEstado; titulo: string }[] = [
  { estado: "PENDIENTE", titulo: "Pendiente" },
  { estado: "EN_CURSO", titulo: "En curso" },
  { estado: "TERMINADO", titulo: "Terminado" },
];

function TareaForm({
  proyectoId,
  empleados,
  onDone,
}: {
  proyectoId: string;
  empleados: EmpleadoOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Falta el título de la tarea.");
      return;
    }
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const result = await createPipelineTarea(formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Tarea creada.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="proyectoId" value={proyectoId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="descripcion">Descripción (opcional)</Label>
        <Textarea id="descripcion" name="descripcion" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="responsable">Responsable (opcional)</Label>
          <Select id="responsable" name="responsable" defaultValue="">
            <option value="">Sin asignar</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.nombre}>
                {e.nombre}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prioridad">Prioridad</Label>
          <Select id="prioridad" name="prioridad" defaultValue="MEDIA">
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vencimiento">Vencimiento (opcional)</Label>
        <Input id="vencimiento" name="vencimiento" type="date" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Creando..." : "Crear tarea"}
        </Button>
      </div>
    </form>
  );
}

function TareaCard({ tarea, proyectoId }: { tarea: TareaItem; proyectoId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleEstadoChange(estado: string) {
    setBusy(true);
    const result = await updatePipelineTareaEstado(tarea.id, proyectoId, estado);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    const result = await deletePipelineTarea(tarea.id, proyectoId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Tarea borrada.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{tarea.titulo}</p>
        <Button
          size="sm"
          variant="delete"
          className="h-6 w-6 shrink-0 p-0"
          title="Borrar"
          disabled={busy}
          onClick={handleDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {tarea.descripcion && <p className="text-xs text-muted-foreground">{tarea.descripcion}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={pipelinePrioridadBadgeVariant(tarea.prioridad)}>
          {pipelinePrioridadLabel(tarea.prioridad)}
        </Badge>
        {tarea.responsable && (
          <span className="text-xs text-muted-foreground">{tarea.responsable}</span>
        )}
        {tarea.vencimientoISO && (
          <span className="text-xs text-muted-foreground">
            vence {new Date(tarea.vencimientoISO).toLocaleDateString("es-AR")}
          </span>
        )}
      </div>
      <Select
        value={tarea.estado}
        disabled={busy}
        onChange={(e) => handleEstadoChange(e.target.value)}
        className="h-8 text-xs"
      >
        {PIPELINE_TAREA_ESTADOS.map((estado) => (
          <option key={estado} value={estado}>
            {pipelineTareaEstadoLabel(estado)}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function PipelineDetailClient({
  proyecto,
  tareas,
  empleados,
}: {
  proyecto: ProyectoDetalle;
  tareas: TareaItem[];
  empleados: EmpleadoOption[];
}) {
  const [creatingOpen, setCreatingOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={pipelineProyectoEstadoBadgeVariant(proyecto.estado)}>
            {pipelineProyectoEstadoLabel(proyecto.estado)}
          </Badge>
          <Badge variant={pipelinePrioridadBadgeVariant(proyecto.prioridad)}>
            {pipelinePrioridadLabel(proyecto.prioridad)}
          </Badge>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 md:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Cliente</dt>
            <dd>{proyecto.clienteNombre || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Equipo</dt>
            <dd>{proyecto.miembros.length > 0 ? proyecto.miembros.join(", ") : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Inicio</dt>
            <dd>{proyecto.fechaInicioISO ? new Date(proyecto.fechaInicioISO).toLocaleDateString("es-AR") : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fin estimado</dt>
            <dd>{proyecto.fechaFinISO ? new Date(proyecto.fechaFinISO).toLocaleDateString("es-AR") : "—"}</dd>
          </div>
        </dl>
        {proyecto.notas && <p className="mt-3 text-sm text-muted-foreground">{proyecto.notas}</p>}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva tarea
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNAS.map((col) => {
          const items = tareas.filter((t) => t.estado === col.estado);
          return (
            <div key={col.estado} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{col.titulo}</h2>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin tareas en esta columna.</p>
                )}
                {items.map((t) => (
                  <TareaCard key={t.id} tarea={t} proyectoId={proyecto.id} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={creatingOpen} onOpenChange={setCreatingOpen} title="Nueva tarea" className="max-w-lg">
        <TareaForm proyectoId={proyecto.id} empleados={empleados} onDone={() => setCreatingOpen(false)} />
      </Dialog>
    </div>
  );
}
