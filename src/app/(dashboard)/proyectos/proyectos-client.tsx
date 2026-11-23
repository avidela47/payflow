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
  proyectoEstadoLabel,
  proyectoEstadoBadgeVariant,
  PROYECTO_PRIORIDADES,
  type ProyectoEstado,
  type ProyectoPrioridad,
} from "@/lib/proyecto-estados";
import { createProyecto, deleteProyecto } from "./actions";

export type ProyectoListItem = {
  id: string;
  numero: string;
  cliente: string;
  nombre?: string;
  prioridad: ProyectoPrioridad;
  estado: ProyectoEstado;
  items: { modelo: string; cantidadSolicitada: number; cantidadCompletada: number }[];
  numeroOrdenTrabajo?: string;
  createdAtISO: string;
};

type ItemForm = { modelo: string; cantidadSolicitada: number };

function emptyItem(): ItemForm {
  return { modelo: "", cantidadSolicitada: 1 };
}

function ProyectoForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);

  function actualizarItem(index: number, patch: Partial<ItemForm>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function agregarItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function quitarItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const itemsValidos = items.filter((it) => it.modelo.trim() && it.cantidadSolicitada > 0);
    if (itemsValidos.length === 0) {
      toast.error("Agregá al menos un modelo.");
      return;
    }

    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("itemsJson", JSON.stringify(itemsValidos));
    const result = await createProyecto(formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Proyecto de fábrica creado.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cliente">Cliente</Label>
        <Input id="cliente" name="cliente" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nombre">Nombre / referencia (opcional)</Label>
        <Input id="nombre" name="nombre" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fechaObjetivo">Fecha objetivo (opcional)</Label>
          <Input id="fechaObjetivo" name="fechaObjetivo" type="date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prioridad">Prioridad</Label>
          <Select id="prioridad" name="prioridad" defaultValue="NORMAL">
            {PROYECTO_PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {p === "URGENTE" ? "Urgente" : "Normal"}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Modelos a fabricar</Label>
        <div className="flex flex-col gap-2 rounded-md border border-border p-2">
          {items.map((it, index) => (
            <div key={index} className="grid grid-cols-[2fr_100px_32px] items-center gap-2">
              <Input
                placeholder="Modelo (código de receta)"
                value={it.modelo}
                onChange={(e) => actualizarItem(index, { modelo: e.target.value })}
              />
              <Input
                type="number"
                min={1}
                step={1}
                value={it.cantidadSolicitada}
                onChange={(e) => actualizarItem(index, { cantidadSolicitada: Number(e.target.value) })}
              />
              <Button type="button" size="sm" variant="delete" onClick={() => quitarItem(index)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={agregarItem}>
          <Plus className="h-3.5 w-3.5" />
          Agregar modelo
        </Button>
      </div>

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

export function ProyectosClient({ items }: { items: ProyectoListItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProyectoListItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.numero, it.cliente, it.nombre ?? ""].some((f) => f.toLowerCase().includes(q))
    );
  }, [items, search]);

  async function performDelete(item: ProyectoListItem) {
    setProcessingId(item.id);
    const result = await deleteProyecto(item.id);
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
            placeholder="Buscar por número, cliente o nombre..."
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
            <TableHead className="whitespace-nowrap">Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="whitespace-nowrap">Avance</TableHead>
            <TableHead className="whitespace-nowrap">Prioridad</TableHead>
            <TableHead className="whitespace-nowrap">Origen</TableHead>
            <TableHead className="whitespace-nowrap">Estado</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "No hay proyectos de fábrica."
                  : "No se encontró ningún proyecto con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((it) => {
            const solicitado = it.items.reduce((a, i) => a + i.cantidadSolicitada, 0);
            const completado = it.items.reduce((a, i) => a + i.cantidadCompletada, 0);
            return (
              <TableRow key={it.id}>
                <TableCell className="whitespace-nowrap font-medium">{it.numero}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {it.cliente}
                  {it.nombre && <span className="text-muted-foreground"> — {it.nombre}</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {completado}/{solicitado}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {it.prioridad === "URGENTE" ? (
                    <Badge variant="destructive">Urgente</Badge>
                  ) : (
                    <Badge variant="default">Normal</Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {it.numeroOrdenTrabajo || "Manual"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={proyectoEstadoBadgeVariant(it.estado)}>
                    {proyectoEstadoLabel(it.estado)}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/proyectos/${it.id}`}>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:bg-muted" title="Ver">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="delete"
                      disabled={it.estado !== "NUEVO"}
                      title={
                        it.estado === "NUEVO"
                          ? "Borrar"
                          : "Solo se puede borrar un proyecto que todavía no fue tomado por el taller."
                      }
                      onClick={() => setDeleteTarget(it)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={creatingOpen} onOpenChange={setCreatingOpen} title="Nuevo proyecto de fábrica" className="max-w-xl">
        <ProyectoForm onDone={() => setCreatingOpen(false)} />
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
              ¿Seguro que querés borrar el proyecto{" "}
              <span className="font-medium text-foreground">{deleteTarget.numero}</span>? No se puede
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
