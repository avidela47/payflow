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
  SENSOR_FUENTE_TIPOS,
  sensorFuenteTipoLabel,
  type SensorFuenteTipo,
} from "@/lib/sensor-fuente-tipos";
import { createSensorFuente, updateSensorFuente, deleteSensorFuente } from "./actions";

// Mismo criterio que reportes/gastos/page.tsx: estos ítems de planta se
// cotizan en dólares, no en pesos (a diferencia del resto de PayFlow, que
// es todo ARS) — por eso NO se usa formatCurrency acá.
function formatUsd(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export type SensorFuenteItem = {
  id: string;
  codigo: string;
  descripcion: string;
  tipo: SensorFuenteTipo;
  stockActual: number;
  stockMinimo: number;
  precio: number;
  proveedor?: string;
  notas?: string;
};

// ---------- formulario de crear/editar (contenido del Dialog) ----------

function SensorFuenteForm({
  mode,
  itemId,
  defaultValues,
  onDone,
}: {
  mode: "create" | "edit";
  itemId?: string;
  defaultValues?: SensorFuenteItem;
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
        ? await createSensorFuente(formData)
        : await updateSensorFuente(itemId as string, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(mode === "create" ? "Ítem creado." : "Ítem actualizado.");
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
            placeholder="Ej: SF-001"
            defaultValue={defaultValues?.codigo}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <Select id="tipo" name="tipo" required defaultValue={defaultValues?.tipo ?? ""}>
            <option value="" disabled>
              Seleccionar...
            </option>
            {SENSOR_FUENTE_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {sensorFuenteTipoLabel(tipo)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="descripcion">Descripción</Label>
        <Input
          id="descripcion"
          name="descripcion"
          required
          placeholder="Descripción del producto"
          defaultValue={defaultValues?.descripcion}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stockActual">Stock actual</Label>
          <Input
            id="stockActual"
            name="stockActual"
            type="number"
            min={0}
            step={1}
            defaultValue={defaultValues?.stockActual ?? 0}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stockMinimo">Stock mínimo</Label>
          <Input
            id="stockMinimo"
            name="stockMinimo"
            type="number"
            min={0}
            step={1}
            defaultValue={defaultValues?.stockMinimo ?? 0}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="precio">Precio (U$D)</Label>
          <Input
            id="precio"
            name="precio"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaultValues?.precio ?? 0}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="proveedor">Proveedor</Label>
        <Input
          id="proveedor"
          name="proveedor"
          placeholder="Nombre del proveedor"
          defaultValue={defaultValues?.proveedor}
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
          {saving ? "Guardando..." : mode === "create" ? "Crear ítem" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function SensoresClient({ items }: { items: SensorFuenteItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SensorFuenteItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SensorFuenteItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        !q ||
        [item.codigo, item.descripcion, item.proveedor].some((field) =>
          field?.toLowerCase().includes(q)
        );
      const matchTipo = filtroTipo === "todos" || item.tipo === filtroTipo;
      return matchSearch && matchTipo;
    });
  }, [items, search, filtroTipo]);

  async function performDelete(item: SensorFuenteItem) {
    setDeletingId(item.id);
    const result = await deleteSensorFuente(item.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Ítem borrado.");
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, descripción o proveedor..."
              className="pl-9"
            />
          </div>
          <Select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="sm:w-56"
          >
            <option value="todos">Todos los tipos</option>
            {SENSOR_FUENTE_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {sensorFuenteTipoLabel(tipo)}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo ítem
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="whitespace-nowrap">Tipo</TableHead>
            <TableHead className="whitespace-nowrap">Stock</TableHead>
            <TableHead className="whitespace-nowrap">Precio</TableHead>
            <TableHead className="whitespace-nowrap">Proveedor</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "Todavía no hay sensores ni fuentes cargados."
                  : "No se encontró ningún ítem con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((item) => {
            const bajoMinimo = item.stockActual < item.stockMinimo;
            return (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap font-medium">{item.codigo}</TableCell>
                <TableCell className="max-w-[260px] truncate">{item.descripcion}</TableCell>
                <TableCell className="whitespace-nowrap">{sensorFuenteTipoLabel(item.tipo)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span>{item.stockActual}</span>
                    {bajoMinimo && (
                      <Badge variant="warning">Bajo mínimo ({item.stockMinimo})</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">U$D {formatUsd(item.precio)}</TableCell>
                <TableCell className="max-w-[160px] truncate">{item.proveedor || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary hover:bg-primary/10"
                      onClick={() => setEditTarget(item)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
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
        title="Nuevo sensor o fuente"
        className="max-w-lg"
      >
        <SensorFuenteForm mode="create" onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar ítem"
        className="max-w-lg"
      >
        {editTarget && (
          <SensorFuenteForm
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
        title="Borrar ítem"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar{" "}
              <span className="font-medium text-foreground">{deleteTarget.descripcion}</span> (
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