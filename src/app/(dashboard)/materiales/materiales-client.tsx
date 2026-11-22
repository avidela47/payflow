"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronUp, Plus, RotateCcw, Search } from "lucide-react";
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
  MATERIAL_UNIDADES,
  materialUnidadLabel,
  type MaterialUnidad,
} from "@/lib/material-unidades";
import {
  movimientoMaterialTipoLabel,
  movimientoMaterialTipoBadgeVariant,
  type MovimientoMaterialTipo,
} from "@/lib/movimiento-material-tipos";
import {
  createMaterial,
  updateMaterial,
  deleteMaterial,
  registrarMovimientoMaterial,
  getMovimientosMaterial,
} from "./actions";

// Mismo criterio que Sensores/Luminarias: estos ítems de planta se cotizan
// en dólares, no en pesos (confirmado por Ariel para Materiales de obra).
function formatUsd(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export type MaterialItem = {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: MaterialUnidad;
  stockActual: number;
  stockMinimo: number;
  precio: number;
  proveedor?: string;
  notas?: string;
};

// ---------- formulario de crear/editar (contenido del Dialog) ----------

function MaterialForm({
  mode,
  itemId,
  defaultValues,
  onDone,
}: {
  mode: "create" | "edit";
  itemId?: string;
  defaultValues?: MaterialItem;
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
        ? await createMaterial(formData)
        : await updateMaterial(itemId as string, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(mode === "create" ? "Material creado." : "Material actualizado.");
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
            placeholder="Ej: MAT-001"
            defaultValue={defaultValues?.codigo}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unidad">Unidad</Label>
          <Select id="unidad" name="unidad" required defaultValue={defaultValues?.unidad ?? "UNIDAD"}>
            {MATERIAL_UNIDADES.map((unidad) => (
              <option key={unidad} value={unidad}>
                {materialUnidadLabel(unidad)}
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
          placeholder="Descripción del material"
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
          {saving ? "Guardando..." : mode === "create" ? "Crear material" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ---------- formulario de movimiento (Entrada/Salida/Devolución) ----------

type MovimientoRow = {
  id: string;
  tipo: MovimientoMaterialTipo;
  cantidad: number;
  stockResultante: number;
  numeroOrden?: string;
  notas?: string;
  usuario: string;
  createdAt: string;
};

const MOVIMIENTO_CONFIG: Record<
  MovimientoMaterialTipo,
  { icon: typeof ArrowDownCircle; placeholderNotas: string }
> = {
  ENTRADA: { icon: ArrowDownCircle, placeholderNotas: "Observaciones" },
  SALIDA: { icon: ArrowUpCircle, placeholderNotas: "Observaciones" },
  DEVOLUCION: { icon: RotateCcw, placeholderNotas: "Ej: Sobrante de obra" },
};

function MovimientoForm({
  material,
  tipo,
  onDone,
}: {
  material: MaterialItem;
  tipo: MovimientoMaterialTipo;
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const cfg = MOVIMIENTO_CONFIG[tipo];
  const Icon = cfg.icon;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("tipo", tipo);
    const result = await registrarMovimientoMaterial(material.id, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Movimiento registrado.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-md bg-muted p-3 text-sm">
        <p className="font-medium">{material.codigo}</p>
        <p className="text-muted-foreground">{material.descripcion}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Stock actual: <span className="font-semibold text-foreground">{material.stockActual}</span>{" "}
          {materialUnidadLabel(material.unidad)}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cantidad">Cantidad</Label>
        <Input id="cantidad" name="cantidad" type="number" min={1} step={1} required defaultValue={1} />
      </div>

      {(tipo === "SALIDA" || tipo === "DEVOLUCION") && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="numeroOrden">Número de OT *</Label>
          <Input
            id="numeroOrden"
            name="numeroOrden"
            required
            placeholder="Ej: OT-0042"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notas">Notas</Label>
        <Input id="notas" name="notas" placeholder={cfg.placeholderNotas} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          <Icon className="h-4 w-4" />
          {saving ? "Guardando..." : "Confirmar"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function MaterialesClient({ items }: { items: MaterialItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState<string>("todos");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MaterialItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movimientoTarget, setMovimientoTarget] = useState<{
    item: MaterialItem;
    tipo: MovimientoMaterialTipo;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Record<string, MovimientoRow[] | undefined>>({});
  const [loadingHistorialId, setLoadingHistorialId] = useState<string | null>(null);

  async function toggleHistorial(item: MaterialItem) {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    if (historial[item.id]) return;

    setLoadingHistorialId(item.id);
    const result = await getMovimientosMaterial(item.id);
    setLoadingHistorialId(null);

    if (!result.ok) {
      toast.error(result.error ?? "No se pudo cargar el historial.");
      return;
    }
    setHistorial((prev) => ({ ...prev, [item.id]: result.data }));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        !q ||
        [item.codigo, item.descripcion, item.proveedor].some((field) =>
          field?.toLowerCase().includes(q)
        );
      const matchUnidad = filtroUnidad === "todos" || item.unidad === filtroUnidad;
      return matchSearch && matchUnidad;
    });
  }, [items, search, filtroUnidad]);

  async function performDelete(item: MaterialItem) {
    setDeletingId(item.id);
    const result = await deleteMaterial(item.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Material borrado.");
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
            value={filtroUnidad}
            onChange={(e) => setFiltroUnidad(e.target.value)}
            className="sm:w-48"
          >
            <option value="todos">Todas las unidades</option>
            {MATERIAL_UNIDADES.map((unidad) => (
              <option key={unidad} value={unidad}>
                {materialUnidadLabel(unidad)}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo material
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
            <TableHead className="whitespace-nowrap">Movimientos</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "Todavía no hay materiales cargados."
                  : "No se encontró ningún material con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((item) => {
            const bajoMinimo = item.stockActual < item.stockMinimo;
            const expanded = expandedId === item.id;
            const rows = historial[item.id];
            return (
              <Fragment key={item.id}>
                <TableRow>
                  <TableCell className="whitespace-nowrap font-medium">{item.codigo}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{item.descripcion}</TableCell>
                  <TableCell className="whitespace-nowrap">{materialUnidadLabel(item.unidad)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{item.stockActual}</span>
                      {bajoMinimo && (
                        <Badge variant="warning">Bajo mínimo ({item.stockMinimo})</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">U$D {formatUsd(item.precio)}</TableCell>
                  <TableCell className="max-w-[140px] truncate">{item.proveedor || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="edit"
                        onClick={() => setMovimientoTarget({ item, tipo: "ENTRADA" })}
                      >
                        <ArrowDownCircle className="h-3.5 w-3.5" />
                        Entrada
                      </Button>
                      <Button
                        size="sm"
                        variant="delete"
                        onClick={() => setMovimientoTarget({ item, tipo: "SALIDA" })}
                      >
                        <ArrowUpCircle className="h-3.5 w-3.5" />
                        Salida
                      </Button>
                      <Button
                        size="sm"
                        variant="info"
                        onClick={() => setMovimientoTarget({ item, tipo: "DEVOLUCION" })}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Dev.
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:bg-muted"
                        onClick={() => toggleHistorial(item)}
                      >
                        {expanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        Historial
                      </Button>
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
                {expanded && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted/40 p-0">
                      <div className="p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Historial de movimientos
                        </p>
                        {loadingHistorialId === item.id ? (
                          <p className="text-sm text-muted-foreground">Cargando...</p>
                        ) : !rows || rows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border text-left text-muted-foreground">
                                  <th className="whitespace-nowrap py-1.5 pr-4 font-medium">Fecha</th>
                                  <th className="whitespace-nowrap py-1.5 pr-4 font-medium">Tipo</th>
                                  <th className="whitespace-nowrap py-1.5 pr-4 font-medium">Cantidad</th>
                                  <th className="whitespace-nowrap py-1.5 pr-4 font-medium">Stock resultante</th>
                                  <th className="whitespace-nowrap py-1.5 pr-4 font-medium">OT</th>
                                  <th className="py-1.5 pr-4 font-medium">Notas</th>
                                  <th className="whitespace-nowrap py-1.5 pr-4 font-medium">Usuario</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((mov) => (
                                  <tr key={mov.id} className="border-b border-border/60">
                                    <td className="whitespace-nowrap py-1.5 pr-4">
                                      {new Date(mov.createdAt).toLocaleDateString("es-AR")}
                                    </td>
                                    <td className="whitespace-nowrap py-1.5 pr-4">
                                      <Badge variant={movimientoMaterialTipoBadgeVariant(mov.tipo)}>
                                        {movimientoMaterialTipoLabel(mov.tipo)}
                                      </Badge>
                                    </td>
                                    <td className="whitespace-nowrap py-1.5 pr-4 font-medium">
                                      {mov.tipo === "SALIDA" ? "-" : "+"}
                                      {mov.cantidad}
                                    </td>
                                    <td className="whitespace-nowrap py-1.5 pr-4">{mov.stockResultante}</td>
                                    <td className="whitespace-nowrap py-1.5 pr-4">{mov.numeroOrden || "—"}</td>
                                    <td className="py-1.5 pr-4 text-muted-foreground">{mov.notas || "—"}</td>
                                    <td className="whitespace-nowrap py-1.5 pr-4 text-muted-foreground">
                                      {mov.usuario || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      <Dialog
        open={creatingOpen}
        onOpenChange={setCreatingOpen}
        title="Nuevo material"
        className="max-w-lg"
      >
        <MaterialForm mode="create" onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar material"
        className="max-w-lg"
      >
        {editTarget && (
          <MaterialForm
            mode="edit"
            itemId={editTarget.id}
            defaultValues={editTarget}
            onDone={() => setEditTarget(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={movimientoTarget !== null}
        onOpenChange={(open) => {
          if (!open) setMovimientoTarget(null);
        }}
        title={
          movimientoTarget ? `${movimientoMaterialTipoLabel(movimientoTarget.tipo)} de material` : ""
        }
        className="max-w-md"
      >
        {movimientoTarget && (
          <MovimientoForm
            material={movimientoTarget.item}
            tipo={movimientoTarget.tipo}
            onDone={() => {
              const id = movimientoTarget.item.id;
              setMovimientoTarget(null);
              setHistorial((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
              });
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar material"
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