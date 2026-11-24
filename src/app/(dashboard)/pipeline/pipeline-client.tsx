"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Plus, Search, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  PIPELINE_PROYECTO_ESTADOS,
  pipelineProyectoEstadoLabel,
  pipelineProyectoEstadoBadgeVariant,
  pipelinePrioridadLabel,
  pipelinePrioridadBadgeVariant,
  type PipelineProyectoEstado,
  type PipelinePrioridad,
} from "@/lib/pipeline-estados";
import { createPipelineProyecto, deletePipelineProyecto, updatePipelineProyectoEstado } from "./actions";

export type ProyectoItem = {
  id: string;
  nombre: string;
  clienteId?: string;
  clienteNombre?: string;
  color: string;
  miembros: string[];
  fechaInicioISO?: string;
  fechaFinISO?: string;
  prioridad: PipelinePrioridad;
  estado: PipelineProyectoEstado;
};

export type ClienteOption = { id: string; nombre: string };
export type EmpleadoOption = { id: string; nombre: string };

// ---------- formulario de creación ----------

function ProyectoForm({
  clientes,
  empleados,
  onDone,
}: {
  clientes: ClienteOption[];
  empleados: EmpleadoOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [color, setColor] = useState("#e8720c");
  const [miembros, setMiembros] = useState<string[]>([]);

  function seleccionarCliente(id: string) {
    setClienteId(id);
    const c = clientes.find((cl) => cl.id === id);
    setClienteNombre(c ? c.nombre : "");
  }

  function toggleMiembro(nombreEmpleado: string) {
    setMiembros((prev) =>
      prev.includes(nombreEmpleado) ? prev.filter((m) => m !== nombreEmpleado) : [...prev, nombreEmpleado]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("Falta el nombre del proyecto.");
      return;
    }

    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("miembrosJson", JSON.stringify(miembros));
    const result = await createPipelineProyecto(formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Proyecto creado.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nombre">Nombre del proyecto</Label>
        <Input id="nombre" name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clienteSelect">Cliente (opcional)</Label>
        <Select id="clienteSelect" value={clienteId} onChange={(e) => seleccionarCliente(e.target.value)}>
          <option value="">Sin cliente — proyecto interno</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <input type="hidden" name="clienteId" value={clienteId} />
        <input type="hidden" name="clienteNombre" value={clienteNombre} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fechaInicio">Inicio</Label>
          <Input id="fechaInicio" name="fechaInicio" type="date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fechaFin">Fin estimado</Label>
          <Input id="fechaFin" name="fechaFin" type="date" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prioridad">Prioridad</Label>
          <Select id="prioridad" name="prioridad" defaultValue="MEDIA">
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            name="color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-full p-1"
          />
        </div>
      </div>

      {empleados.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Miembros del equipo</Label>
          <div className="flex flex-wrap gap-2 rounded-md border border-border p-2">
            {empleados.map((e) => {
              const activo = miembros.includes(e.nombre);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggleMiembro(e.nombre)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                    (activo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted")
                  }
                >
                  {e.nombre}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notas">Notas (opcional)</Label>
        <Textarea id="notas" name="notas" rows={2} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Creando..." : "Crear proyecto"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function PipelineClient({
  items,
  clientes,
  empleados,
}: {
  items: ProyectoItem[];
  clientes: ClienteOption[];
  empleados: EmpleadoOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProyectoItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.nombre, it.clienteNombre ?? ""].some((f) => f.toLowerCase().includes(q))
    );
  }, [items, search]);

  async function handleEstadoChange(item: ProyectoItem, estado: string) {
    setProcessingId(item.id);
    const result = await updatePipelineProyectoEstado(item.id, estado);
    setProcessingId(null);
    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    router.refresh();
  }

  async function performDelete(item: ProyectoItem) {
    setProcessingId(item.id);
    const result = await deletePipelineProyecto(item.id);
    setProcessingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Proyecto borrado.");
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o cliente..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo proyecto
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead>Proyecto</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="whitespace-nowrap">Equipo</TableHead>
            <TableHead className="whitespace-nowrap">Fechas</TableHead>
            <TableHead className="whitespace-nowrap">Prioridad</TableHead>
            <TableHead className="whitespace-nowrap">Estado</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "Todavía no hay proyectos cargados."
                  : "No se encontró ningún proyecto con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((it) => (
            <TableRow key={it.id}>
              <TableCell className="whitespace-nowrap font-medium">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: it.color }} />
                {it.nombre}
              </TableCell>
              <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                {it.clienteNombre || "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {it.miembros.length > 0 ? it.miembros.join(", ") : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {it.fechaInicioISO ? new Date(it.fechaInicioISO).toLocaleDateString("es-AR") : "—"}
                {" → "}
                {it.fechaFinISO ? new Date(it.fechaFinISO).toLocaleDateString("es-AR") : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant={pipelinePrioridadBadgeVariant(it.prioridad)}>
                  {pipelinePrioridadLabel(it.prioridad)}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Select
                  value={it.estado}
                  disabled={processingId === it.id}
                  onChange={(e) => handleEstadoChange(it, e.target.value)}
                  className="h-8 w-[140px] text-xs"
                >
                  {PIPELINE_PROYECTO_ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {pipelineProyectoEstadoLabel(estado)}
                    </option>
                  ))}
                </Select>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center justify-end gap-1">
                  <Link href={`/pipeline/${it.id}`}>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:bg-muted" title="Ver tareas">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="delete" title="Borrar" onClick={() => setDeleteTarget(it)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={creatingOpen} onOpenChange={setCreatingOpen} title="Nuevo proyecto" className="max-w-2xl">
        <ProyectoForm clientes={clientes} empleados={empleados} onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar proyecto"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar{" "}
              <span className="font-medium text-foreground">{deleteTarget.nombre}</span>? No se puede
              deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={processingId === deleteTarget.id}
                onClick={() => performDelete(deleteTarget)}
              >
                {processingId === deleteTarget.id ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
