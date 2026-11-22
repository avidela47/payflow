"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Trash2, FileText } from "lucide-react";
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
import { createReceta, updateReceta, deleteReceta } from "./actions";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export type ComponenteOpcion = {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  foto?: string;
};

export type RecetaComponenteItem = {
  componenteId: string;
  codigoComponente: string;
  descripcionComponente: string;
  cantidad: number;
};

export type RecetaItem = {
  id: string;
  codigo: string;
  nombre: string;
  version: number;
  fechaVersionISO: string;
  activa: boolean;
  componentes: RecetaComponenteItem[];
  notas?: string;
  foto?: string;
};

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

// ---------- formulario de crear/editar (contenido del Dialog) ----------

function RecetaForm({
  mode,
  itemId,
  defaultValues,
  opcionesComponentes,
  onDone,
}: {
  mode: "create" | "edit";
  itemId?: string;
  defaultValues?: RecetaItem;
  opcionesComponentes: ComponenteOpcion[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(defaultValues?.foto);
  const [activa, setActiva] = useState(defaultValues?.activa ?? true);
  const [lineas, setLineas] = useState<{ componenteId: string; cantidad: number }[]>(
    defaultValues?.componentes.map((c) => ({
      componenteId: c.componenteId,
      cantidad: c.cantidad,
    })) ?? []
  );

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

  function agregarLinea() {
    setLineas((prev) => [...prev, { componenteId: "", cantidad: 1 }]);
  }

  function quitarLinea(index: number) {
    setLineas((prev) => prev.filter((_, i) => i !== index));
  }

  function actualizarLinea(index: number, campo: "componenteId" | "cantidad", valor: string | number) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, [campo]: valor } : l)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (lineas.length === 0) {
      toast.error("Agregá al menos un componente.");
      return;
    }
    if (lineas.some((l) => !l.componenteId || l.cantidad < 1)) {
      toast.error("Todos los componentes necesitan código y cantidad válida.");
      return;
    }

    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("activa", activa ? "true" : "false");
    formData.set("componentesJson", JSON.stringify(lineas));
    const result =
      mode === "create"
        ? await createReceta(formData)
        : await updateReceta(itemId as string, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(mode === "create" ? "Receta creada." : "Receta actualizada.");
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
            placeholder="Ej: SYP323-150-100W"
            defaultValue={defaultValues?.codigo}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="activaSelect">Estado</Label>
          <Select
            id="activaSelect"
            value={activa ? "true" : "false"}
            onChange={(e) => setActiva(e.target.value === "true")}
          >
            <option value="true">Activa</option>
            <option value="false">Inactiva</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input
          id="nombre"
          name="nombre"
          required
          placeholder="Ej: Luminaria SYP323 150mm 100W"
          defaultValue={defaultValues?.nombre}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Componentes</Label>
          <Button type="button" size="sm" variant="outline" onClick={agregarLinea}>
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>

        {lineas.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            No hay componentes. Hacé clic en Agregar para empezar.
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-border p-2">
            {lineas.map((linea, index) => (
              <div key={index} className="grid grid-cols-[1fr_90px_auto] items-center gap-2">
                <Select
                  value={linea.componenteId}
                  onChange={(e) => actualizarLinea(index, "componenteId", e.target.value)}
                >
                  <option value="">Seleccionar componente...</option>
                  {opcionesComponentes.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.codigo} — {op.descripcion}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={linea.cantidad}
                  onChange={(e) => actualizarLinea(index, "cantidad", Number(e.target.value))}
                  placeholder="Cant."
                />
                <Button
                  type="button"
                  size="sm"
                  variant="delete"
                  onClick={() => quitarLinea(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
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
          {saving ? "Guardando..." : mode === "create" ? "Crear receta" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ---------- ficha técnica (ver, con link a /imprimir/recetas/[id]) ----------

function FichaReceta({
  receta,
  opcionesComponentes,
}: {
  receta: RecetaItem;
  opcionesComponentes: ComponenteOpcion[];
}) {
  const fotoPorId = new Map(opcionesComponentes.map((op) => [op.id, op.foto]));

  return (
    <div className="flex flex-col gap-4">
      {receta.notas && (
        <p className="rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {receta.notas}
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Componentes necesarios — {receta.componentes.length}{" "}
          {receta.componentes.length === 1 ? "ítem" : "ítems"}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {receta.componentes.map((c) => {
            const foto = fotoPorId.get(c.componenteId);
            return (
              <div key={c.componenteId} className="overflow-hidden rounded-md border border-border">
                <div className="flex h-20 items-center justify-center bg-muted">
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto} alt={c.codigoComponente} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl">📦</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-semibold text-primary">{c.codigoComponente}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.descripcionComponente}</p>
                  <Badge variant="success" className="mt-1">
                    x{c.cantidad}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <a href={`/imprimir/recetas/${receta.id}`} target="_blank" rel="noreferrer">
          <Button type="button" variant="outline">
            <FileText className="h-4 w-4" />
            Abrir ficha para imprimir
          </Button>
        </a>
      </div>
    </div>
  );
}

// ---------- componente principal ----------

export function RecetasClient({
  items,
  opcionesComponentes,
}: {
  items: RecetaItem[];
  opcionesComponentes: ComponenteOpcion[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RecetaItem | null>(null);
  const [fichaTarget, setFichaTarget] = useState<RecetaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecetaItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    return !q || item.codigo.toLowerCase().includes(q) || item.nombre.toLowerCase().includes(q);
  });

  async function performDelete(item: RecetaItem) {
    setDeletingId(item.id);
    const result = await deleteReceta(item.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Receta borrada.");
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
            placeholder="Buscar por código o nombre..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva receta
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead className="whitespace-nowrap">Versión</TableHead>
            <TableHead className="whitespace-nowrap">Componentes</TableHead>
            <TableHead className="whitespace-nowrap">Última actualización</TableHead>
            <TableHead className="whitespace-nowrap">Estado</TableHead>
            <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {items.length === 0
                  ? "Todavía no hay recetas cargadas."
                  : "No se encontró ninguna receta con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap font-medium text-primary">{item.codigo}</TableCell>
              <TableCell className="max-w-[260px] truncate">{item.nombre}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">v{item.version}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {item.componentes.length} {item.componentes.length === 1 ? "componente" : "componentes"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatFecha(item.fechaVersionISO)}
              </TableCell>
              <TableCell>
                <Badge variant={item.activa ? "success" : "destructive"}>
                  {item.activa ? "ACTIVA" : "INACTIVA"}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="edit" onClick={() => setEditTarget(item)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="info" onClick={() => setFichaTarget(item)}>
                    <FileText className="h-3.5 w-3.5" />
                    Ficha
                  </Button>
                  <Button size="sm" variant="delete" onClick={() => setDeleteTarget(item)}>
                    Borrar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={creatingOpen}
        onOpenChange={setCreatingOpen}
        title="Nueva receta"
        className="max-w-lg"
      >
        <RecetaForm
          mode="create"
          opcionesComponentes={opcionesComponentes}
          onDone={() => setCreatingOpen(false)}
        />
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar receta"
        className="max-w-lg"
      >
        {editTarget && (
          <RecetaForm
            mode="edit"
            itemId={editTarget.id}
            defaultValues={editTarget}
            opcionesComponentes={opcionesComponentes}
            onDone={() => setEditTarget(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={fichaTarget !== null}
        onOpenChange={(open) => {
          if (!open) setFichaTarget(null);
        }}
        title={fichaTarget ? `Ficha técnica — ${fichaTarget.codigo}` : undefined}
        description={fichaTarget ? `${fichaTarget.nombre} · v${fichaTarget.version}` : undefined}
        className="max-w-2xl"
      >
        {fichaTarget && (
          <FichaReceta receta={fichaTarget} opcionesComponentes={opcionesComponentes} />
        )}
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar receta"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar la receta{" "}
              <span className="font-medium text-foreground">{deleteTarget.codigo}</span> (
              {deleteTarget.nombre})? No se puede deshacer.
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
