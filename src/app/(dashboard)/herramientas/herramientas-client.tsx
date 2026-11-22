"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
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
  HERRAMIENTA_ESTADOS,
  herramientaEstadoLabel,
  herramientaEstadoBadgeVariant,
  type HerramientaEstado,
} from "@/lib/herramienta-estados";
import { createHerramienta, updateHerramienta, deleteHerramienta } from "./actions";

export type HerramientaItem = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  cantidadTotal: number;
  cantidadDisponible: number;
  estado: HerramientaEstado;
  ubicacion?: string;
  notas?: string;
};

// ---------- formulario de crear/editar (contenido del Dialog) ----------

function HerramientaForm({
  mode,
  itemId,
  defaultValues,
  onDone,
}: {
  mode: "create" | "edit";
  itemId?: string;
  defaultValues?: HerramientaItem;
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const result =
      mode === "create"
        ? await createHerramienta(formData)
        : await updateHerramienta(itemId as string, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(mode === "create" ? "Herramienta creada." : "Herramienta actualizada.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="codigo">Código</Label>
          <Input
            id="codigo"
            name="codigo"
            required
            readOnly={mode === "edit"}
            className={mode === "edit" ? "bg-muted" : undefined}
            placeholder="Ej: HER-001"
            defaultValue={defaultValues?.codigo}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            name="nombre"
            required
            placeholder="Ej: Taladro percutor"
            defaultValue={defaultValues?.nombre}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="descripcion">Descripción</Label>
        <Input
          id="descripcion"
          name="descripcion"
          placeholder="Descripción de la herramienta"
          defaultValue={defaultValues?.descripcion}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cantidadTotal">Cantidad total</Label>
          <Input
            id="cantidadTotal"
            name="cantidadTotal"
            type="number"
            min={0}
            step={1}
            defaultValue={defaultValues?.cantidadTotal ?? 1}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cantidadDisponible">Cantidad disponible</Label>
          <Input
            id="cantidadDisponible"
            name="cantidadDisponible"
            type="number"
            min={0}
            step={1}
            defaultValue={defaultValues?.cantidadDisponible ?? 1}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="estado">Estado</Label>
          <Select id="estado" name="estado" required defaultValue={defaultValues?.estado ?? "DISPONIBLE"}>
            {HERRAMIENTA_ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {herramientaEstadoLabel(estado)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ubicacion">Ubicación</Label>
        <Input
          id="ubicacion"
          name="ubicacion"
          placeholder="Ej: Depósito, Camioneta 1..."
          defaultValue={defaultValues?.ubicacion}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" name="notas" rows={3} defaultValue={defaultValues?.notas} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : mode === "create" ? "Crear herramienta" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function HerramientasClient({ items }: { items: HerramientaItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HerramientaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HerramientaItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        !q ||
        [item.codigo, item.nombre, item.descripcion, item.ubicacion].some((field) =>
          field?.toLowerCase().includes(q)
        );
      const matchEstado = filtroEstado === "todos" || item.estado === filtroEstado;
      return matchSearch && matchEstado;
    });
  }, [items, search, filtroEstado]);

  async function performDelete(item: HerramientaItem) {
    setDeletingId(item.id);
    const result = await deleteHerramienta(item.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Herramienta borrada.");
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, nombre o ubicación..."
              className="pl-9"
            />
          </div>
          <Button onClick={() => setCreatingOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva herramienta
          </Button>
        </div>
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          <Button
            type="button"
            size="sm"
            variant={filtroEstado === "todos" ? "default" : "outline"}
            className="shrink-0"
            onClick={() => setFiltroEstado("todos")}
          >
            Todos
          </Button>
          {HERRAMIENTA_ESTADOS.map((estado) => (
            <Button
              key={estado}
              type="button"
              size="sm"
              variant={filtroEstado === estado ? "default" : "outline"}
              className="shrink-0"
              onClick={() => setFiltroEstado(estado)}
            >
              {herramientaEstadoLabel(estado)}
            </Button>
          ))}
        </div>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Código</TableHead>
            <TableHead className="whitespace-nowrap">Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="whitespace-nowrap">Total</TableHead>
            <TableHead className="whitespace-nowrap">Disponible</TableHead>
            <TableHead className="whitespace-nowrap">Estado</TableHead>
            <TableHead className="whitespace-nowrap">Ubicación</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "Todavía no hay herramientas cargadas."
                  : "No se encontró ninguna herramienta con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((item) => {
            const sinDisponibles = item.cantidadDisponible <= 0 && item.cantidadTotal > 0;
            return (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap font-medium">{item.codigo}</TableCell>
                <TableCell className="max-w-[200px] truncate">{item.nombre}</TableCell>
                <TableCell className="max-w-[220px] truncate text-muted-foreground">
                  {item.descripcion || "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-center">{item.cantidadTotal}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span>{item.cantidadDisponible}</span>
                    {sinDisponibles && <Badge variant="warning">Sin stock libre</Badge>}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={herramientaEstadoBadgeVariant(item.estado)}>
                    {herramientaEstadoLabel(item.estado)}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[160px] truncate">{item.ubicacion || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="edit"
                      onClick={() => setEditTarget(item)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="delete"
                      onClick={() => setDeleteTarget(item)}
                    >
                      Borrar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog
        open={creatingOpen}
        onOpenChange={setCreatingOpen}
        title="Nueva herramienta"
        className="max-w-lg"
      >
        <HerramientaForm mode="create" onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar herramienta"
        className="max-w-lg"
      >
        {editTarget && (
          <HerramientaForm
            mode="edit"
            itemId={editTarget.id}
            defaultValues={editTarget}
            onDone={() => setEditTarget(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar herramienta"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar{" "}
              <span className="font-medium text-foreground">{deleteTarget.nombre}</span> (
              {deleteTarget.codigo})? No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deletingId === deleteTarget.id}
                onClick={() => performDelete(deleteTarget)}
              >
                {deletingId === deleteTarget.id ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}