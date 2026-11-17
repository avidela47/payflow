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
  LUMINARIA_ORIGENES,
  luminariaOrigenLabel,
  luminariaOrigenBadgeVariant,
  type LuminariaOrigen,
} from "@/lib/luminaria-origen";
import { createLuminaria, updateLuminaria, deleteLuminaria } from "./actions";

// Mismo criterio que Sensores y Fuentes / reportes/gastos: se cotiza en
// dólares, no en pesos.
function formatUsd(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export type LuminariaItem = {
  id: string;
  codigo: string;
  descripcion: string;
  origen: LuminariaOrigen;
  stockActual: number;
  stockMinimo: number;
  precio: number;
  proveedor?: string;
  notas?: string;
  tieneReceta: boolean;
};

// ---------- formulario de crear/editar (contenido del Dialog) ----------

function LuminariaForm({
  mode,
  itemId,
  defaultValues,
  onDone,
}: {
  mode: "create" | "edit";
  itemId?: string;
  defaultValues?: LuminariaItem;
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [origen, setOrigen] = useState<LuminariaOrigen | "">(defaultValues?.origen ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const result =
      mode === "create"
        ? await createLuminaria(formData)
        : await updateLuminaria(itemId as string, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(mode === "create" ? "Luminaria creada." : "Luminaria actualizada.");
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
            placeholder="Ej: LUM-001"
            defaultValue={defaultValues?.codigo}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="origen">Origen</Label>
          <Select
            id="origen"
            name="origen"
            required
            value={origen}
            onChange={(e) => setOrigen(e.target.value as LuminariaOrigen)}
          >
            <option value="" disabled>
              Seleccionar...
            </option>
            {LUMINARIA_ORIGENES.map((o) => (
              <option key={o} value={o}>
                {luminariaOrigenLabel(o)}
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
          placeholder="Descripción del modelo"
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

      {origen !== "FABRICADA" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proveedor">Proveedor</Label>
          <Input
            id="proveedor"
            name="proveedor"
            placeholder="Nombre del proveedor"
            defaultValue={defaultValues?.proveedor}
          />
        </div>
      )}

      {origen === "FABRICADA" && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="tieneReceta"
            defaultChecked={defaultValues?.tieneReceta ?? true}
            className="h-4 w-4 rounded border-border"
          />
          Tiene receta (BOM) asociada — informativo por ahora, todavía no hay módulo de Recetas.
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" name="notas" rows={3} defaultValue={defaultValues?.notas} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : mode === "create" ? "Crear luminaria" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function LuminariasClient({ items }: { items: LuminariaItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filtroOrigen, setFiltroOrigen] = useState<string>("todos");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LuminariaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LuminariaItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        !q ||
        [item.codigo, item.descripcion, item.proveedor].some((field) =>
          field?.toLowerCase().includes(q)
        );
      const matchOrigen = filtroOrigen === "todos" || item.origen === filtroOrigen;
      return matchSearch && matchOrigen;
    });
  }, [items, search, filtroOrigen]);

  async function performDelete(item: LuminariaItem) {
    setDeletingId(item.id);
    const result = await deleteLuminaria(item.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Luminaria borrada.");
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
            value={filtroOrigen}
            onChange={(e) => setFiltroOrigen(e.target.value)}
            className="sm:w-56"
          >
            <option value="todos">Todos los orígenes</option>
            {LUMINARIA_ORIGENES.map((o) => (
              <option key={o} value={o}>
                {luminariaOrigenLabel(o)}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva luminaria
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="whitespace-nowrap">Origen</TableHead>
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
                  ? "Todavía no hay luminarias cargadas."
                  : "No se encontró ninguna luminaria con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((item) => {
            const bajoMinimo = item.stockActual < item.stockMinimo;
            return (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap font-medium">{item.codigo}</TableCell>
                <TableCell className="max-w-[260px] truncate">{item.descripcion}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={luminariaOrigenBadgeVariant(item.origen)}>
                    {luminariaOrigenLabel(item.origen)}
                  </Badge>
                </TableCell>
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
        title="Nueva luminaria"
        className="max-w-lg"
      >
        <LuminariaForm mode="create" onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar luminaria"
        className="max-w-lg"
      >
        {editTarget && (
          <LuminariaForm
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
        title="Borrar luminaria"
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