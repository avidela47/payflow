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
import { Dialog } from "@/components/ui/dialog";
import { IVA_CONDITIONS, type IvaCondition } from "@/lib/iva-conditions";
import { ARGENTINA_PROVINCES } from "@/lib/argentina-provinces";
import { createProvider, updateProvider, deleteProvider } from "./actions";

export type ProviderItem = {
  id: string;
  codigo: string;
  nombre: string;
  razonSocial?: string;
  cuit?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  localidad?: string;
  provincia?: string;
  contacto?: string;
  condicionIva?: IvaCondition;
  notas?: string;
};

// ---------- formulario de crear/editar (contenido del Dialog) ----------

function ProviderForm({
  mode,
  providerId,
  defaultValues,
  onDone,
}: {
  mode: "create" | "edit";
  providerId?: string;
  defaultValues?: ProviderItem;
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
        ? await createProvider(formData)
        : await updateProvider(providerId as string, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(mode === "create" ? "Proveedor creado." : "Proveedor actualizado.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === "edit" && defaultValues?.codigo && (
        <p className="text-sm text-muted-foreground">
          Código: <span className="font-medium text-foreground">{defaultValues.codigo}</span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            name="nombre"
            required
            placeholder="Nombre comercial"
            defaultValue={defaultValues?.nombre}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="razonSocial">Razón social</Label>
          <Input id="razonSocial" name="razonSocial" defaultValue={defaultValues?.razonSocial} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cuit">CUIT</Label>
          <Input
            id="cuit"
            name="cuit"
            placeholder="Ej: 20-12345678-9"
            defaultValue={defaultValues?.cuit}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="condicionIva">Condición IVA</Label>
          <select
            id="condicionIva"
            name="condicionIva"
            defaultValue={defaultValues?.condicionIva ?? ""}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Sin especificar</option>
            {IVA_CONDITIONS.map((cond) => (
              <option key={cond} value={cond}>
                {cond}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            name="telefono"
            placeholder="Ej: 351 123-4567"
            defaultValue={defaultValues?.telefono}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            placeholder="correo@empresa.com"
            defaultValue={defaultValues?.email}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="direccion">Dirección</Label>
        <Input
          id="direccion"
          name="direccion"
          placeholder="Calle y número"
          defaultValue={defaultValues?.direccion}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="localidad">Localidad</Label>
          <Input
            id="localidad"
            name="localidad"
            placeholder="Ciudad"
            defaultValue={defaultValues?.localidad}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="provincia">Provincia</Label>
          <select
            id="provincia"
            name="provincia"
            defaultValue={defaultValues?.provincia ?? ""}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Seleccionar...</option>
            {ARGENTINA_PROVINCES.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contacto">Contacto</Label>
        <Input
          id="contacto"
          name="contacto"
          placeholder="Persona de contacto"
          defaultValue={defaultValues?.contacto}
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
          {saving ? "Guardando..." : mode === "create" ? "Crear proveedor" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function ProvidersClient({ providers }: { providers: ProviderItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProviderItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProviderItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) =>
      [p.codigo, p.nombre, p.razonSocial, p.cuit, p.localidad].some((field) =>
        field?.toLowerCase().includes(q)
      )
    );
  }, [providers, search]);

  async function performDelete(provider: ProviderItem) {
    setDeletingId(provider.id);
    const result = await deleteProvider(provider.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Proveedor borrado.");
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
            placeholder="Buscar por código, nombre, CUIT o localidad..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre / Razón social</TableHead>
            <TableHead>CUIT</TableHead>
            <TableHead>Localidad</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Condición IVA</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {providers.length === 0
                  ? "Todavía no hay proveedores cargados."
                  : "No se encontró ningún proveedor con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((provider) => (
            <TableRow key={provider.id}>
              <TableCell className="text-muted-foreground">{provider.codigo}</TableCell>
              <TableCell className="font-medium">
                {provider.nombre}
                {provider.razonSocial && (
                  <div className="text-xs text-muted-foreground">{provider.razonSocial}</div>
                )}
              </TableCell>
              <TableCell>{provider.cuit ?? "—"}</TableCell>
              <TableCell>{provider.localidad ?? "—"}</TableCell>
              <TableCell>{provider.telefono ?? "—"}</TableCell>
              <TableCell>{provider.email ?? "—"}</TableCell>
              <TableCell>{provider.condicionIva ?? "—"}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-primary hover:bg-primary/10"
                    onClick={() => setEditTarget(provider)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(provider)}
                  >
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
        title="Nuevo proveedor"
        className="max-w-lg"
      >
        <ProviderForm mode="create" onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar proveedor"
        className="max-w-lg"
      >
        {editTarget && (
          <ProviderForm
            mode="edit"
            providerId={editTarget.id}
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
        title="Borrar proveedor"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar a{" "}
              <span className="font-medium text-foreground">{deleteTarget.nombre}</span>? No se
              puede deshacer.
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