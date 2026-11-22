"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
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
  COMPONENTE_UNIDADES,
  componenteUnidadLabel,
  type ComponenteUnidad,
} from "@/lib/componente-unidades";
import { createComponente, updateComponente, deleteComponente } from "./actions";

// Igual criterio que el resto del stock de planta (Sensores/Luminarias/
// Materiales): se cotiza en dólares.
function formatUsd(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export type ComponenteItem = {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: ComponenteUnidad;
  stockActual: number;
  stockMinimo: number;
  precio: number;
  proveedor?: string;
  ubicacion?: string;
  notas?: string;
  foto?: string;
  tieneMovimientos?: boolean;
  enReceta?: boolean;
};

// ---------- formulario de crear/editar (contenido del Dialog) ----------

function ComponenteForm({
  mode,
  itemId,
  defaultValues,
  onDone,
}: {
  mode: "create" | "edit";
  itemId?: string;
  defaultValues?: ComponenteItem;
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(defaultValues?.foto);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("La imagen pesa más de 2MB. Comprimila antes de subirla.");
      if (photoInputRef.current) photoInputRef.current.value = "";
      return;
    }
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const result =
      mode === "create"
        ? await createComponente(formData)
        : await updateComponente(itemId as string, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(mode === "create" ? "Componente creado." : "Componente actualizado.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="Foto" className="h-full w-full object-cover" />
          ) : (
            <span className="text-center text-[10px] text-muted-foreground">Sin foto</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="foto">Foto (máx. 2MB)</Label>
          <Input
            id="foto"
            name="foto"
            type="file"
            accept="image/*"
            ref={photoInputRef}
            onChange={handlePhotoChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="codigo">Código</Label>
          <Input
            id="codigo"
            name="codigo"
            required
            readOnly={mode === "edit"}
            className={mode === "edit" ? "bg-muted" : undefined}
            placeholder="Ej: TORN-M4-15"
            defaultValue={defaultValues?.codigo}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unidad">Unidad</Label>
          <Select id="unidad" name="unidad" required defaultValue={defaultValues?.unidad ?? "UNIDAD"}>
            {COMPONENTE_UNIDADES.map((unidad) => (
              <option key={unidad} value={unidad}>
                {componenteUnidadLabel(unidad)}
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
          placeholder="Descripción del componente"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <Label htmlFor="ubicacion">Ubicación</Label>
          <Input
            id="ubicacion"
            name="ubicacion"
            placeholder="Ej: Estante A-3"
            defaultValue={defaultValues?.ubicacion}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" name="notas" rows={2} defaultValue={defaultValues?.notas} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : mode === "create" ? "Crear componente" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------
//
// Simplificado el 2026-11-22: al principio esta tabla tenía los botones de
// Compra/Ajuste+/Ajuste- y el historial desplegable metidos en cada fila.
// Ariel comparó contra la pantalla real de Sistema de Fábrica y ahí
// Componentes y Movimientos son dos pantallas separadas — se corrigió para
// igualar eso (ver /movimientos-componentes). Esta tabla ahora es solo el
// catálogo: alta, edición y borrado.
export function ComponentesClient({ items }: { items: ComponenteItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState<string>("todos");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ComponenteItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ComponenteItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      [item.codigo, item.descripcion, item.proveedor, item.ubicacion].some((field) =>
        field?.toLowerCase().includes(q)
      );
    const matchUnidad = filtroUnidad === "todos" || item.unidad === filtroUnidad;
    return matchSearch && matchUnidad;
  });

  async function performDelete(item: ComponenteItem) {
    setDeletingId(item.id);
    const result = await deleteComponente(item.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Componente borrado.");
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
              placeholder="Buscar por código, descripción, proveedor o ubicación..."
              className="pl-9"
            />
          </div>
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Select
              value={filtroUnidad}
              onChange={(e) => setFiltroUnidad(e.target.value)}
              className="w-48 pl-9"
            >
              <option value="todos">Todas las unidades</option>
              {COMPONENTE_UNIDADES.map((unidad) => (
                <option key={unidad} value={unidad}>
                  {componenteUnidadLabel(unidad)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo componente
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="whitespace-nowrap">Unidad</TableHead>
            <TableHead className="whitespace-nowrap">Stock</TableHead>
            <TableHead className="whitespace-nowrap">Precio</TableHead>
            <TableHead className="whitespace-nowrap">Proveedor</TableHead>
            <TableHead className="whitespace-nowrap">Ubicación</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "Todavía no hay componentes cargados."
                  : "No se encontró ningún componente con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((item) => {
            const bajoMinimo = item.stockActual < item.stockMinimo;
            return (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap font-medium">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                      {item.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.foto} alt={item.codigo} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    {item.codigo}
                  </div>
                </TableCell>
                <TableCell className="max-w-[220px] truncate">{item.descripcion}</TableCell>
                <TableCell className="whitespace-nowrap">{componenteUnidadLabel(item.unidad)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span>{item.stockActual}</span>
                    {bajoMinimo && <Badge variant="warning">Bajo mínimo ({item.stockMinimo})</Badge>}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">U$D {formatUsd(item.precio)}</TableCell>
                <TableCell className="max-w-[140px] truncate">{item.proveedor || "—"}</TableCell>
                <TableCell className="max-w-[140px] truncate">{item.ubicacion || "—"}</TableCell>
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
                      disabled={item.tieneMovimientos || item.enReceta}
                      title={
                        item.tieneMovimientos
                          ? "No se puede borrar: tiene movimientos registrados — queda como historial."
                          : item.enReceta
                            ? "No se puede borrar: está usado en una o más Recetas."
                            : undefined
                      }
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
        title="Nuevo componente"
        className="max-w-lg"
      >
        <ComponenteForm mode="create" onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar componente"
        className="max-w-lg"
      >
        {editTarget && (
          <ComponenteForm
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
        title="Borrar componente"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar{" "}
              <span className="font-medium text-foreground">{deleteTarget.descripcion}</span> (
              {deleteTarget.codigo})? No se puede deshacer. (Un componente con movimientos
              registrados o usado en una Receta no se puede borrar.)
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
