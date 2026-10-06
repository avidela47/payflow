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
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { IVA_CONDITIONS, type IvaCondition } from "@/lib/iva-conditions";
import { ARGENTINA_PROVINCES } from "@/lib/argentina-provinces";
import { createClient, updateClient, deleteClient } from "./actions";

// ---------- helpers visuales (avatar con iniciales, color por cliente, badge por condición IVA) ----------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Mismo cliente = mismo color siempre (hash simple del nombre sobre una
// paleta chica de colores de marca ya definidos en tailwind.config.ts) —
// nada de random en cada render.
const AVATAR_PALETTE = ["bg-primary", "bg-violet", "bg-success", "bg-warning"];

function avatarColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function ivaBadgeVariant(cond?: IvaCondition): "default" | "success" | "warning" | "primary" {
  switch (cond) {
    case "Responsable Inscripto":
      return "success";
    case "Monotributo":
      return "warning";
    case "Exento":
      return "primary";
    default:
      return "default";
  }
}

export type ClientItem = {
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
  formaPago?: string;
  condicionIva?: IvaCondition;
  notas?: string;
};

// ---------- formulario de crear/editar (contenido del Dialog) ----------

function ClientForm({
  mode,
  clientId,
  defaultValues,
  onDone,
}: {
  mode: "create" | "edit";
  clientId?: string;
  defaultValues?: ClientItem;
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
        ? await createClient(formData)
        : await updateClient(clientId as string, formData);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(mode === "create" ? "Cliente creado." : "Cliente actualizado.");
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
          <Select
            id="condicionIva"
            name="condicionIva"
            defaultValue={defaultValues?.condicionIva ?? ""}
          >
            <option value="">Sin especificar</option>
            {IVA_CONDITIONS.map((cond) => (
              <option key={cond} value={cond}>
                {cond}
              </option>
            ))}
          </Select>
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
          <Select
            id="provincia"
            name="provincia"
            defaultValue={defaultValues?.provincia ?? ""}
          >
            <option value="">Seleccionar...</option>
            {ARGENTINA_PROVINCES.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <Label htmlFor="formaPago">Forma de pago</Label>
          <Input
            id="formaPago"
            name="formaPago"
            placeholder="Ej: Transferencia, cheque a 30 días"
            defaultValue={defaultValues?.formaPago}
          />
        </div>
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
          {saving ? "Guardando..." : mode === "create" ? "Crear cliente" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ---------- componente principal ----------

export function ClientsClient({ clients }: { clients: ClientItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.codigo, c.nombre, c.razonSocial, c.cuit, c.localidad].some((field) =>
        field?.toLowerCase().includes(q)
      )
    );
  }, [clients, search]);

  async function performDelete(client: ClientItem) {
    setDeletingId(client.id);
    const result = await deleteClient(client.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Cliente borrado.");
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
          Nuevo cliente
        </Button>
      </div>

      <Table compact>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
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
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {clients.length === 0
                  ? "Todavía no hay clientes cargados."
                  : "No se encontró ningún cliente con esa búsqueda."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${avatarColorClass(
                      client.id
                    )}`}
                  >
                    {getInitials(client.nombre)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{client.nombre}</div>
                    <div className="truncate text-muted-foreground">
                      {client.codigo}
                      {client.razonSocial ? ` · ${client.razonSocial}` : ""}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{client.cuit ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{client.localidad ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{client.telefono ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{client.email ?? "—"}</TableCell>
              <TableCell>
                {client.condicionIva ? (
                  <Badge variant={ivaBadgeVariant(client.condicionIva)}>{client.condicionIva}</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-primary hover:bg-primary/10"
                    onClick={() => setEditTarget(client)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(client)}
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
        title="Nuevo cliente"
        className="max-w-lg"
      >
        <ClientForm mode="create" onDone={() => setCreatingOpen(false)} />
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar cliente"
        className="max-w-lg"
      >
        {editTarget && (
          <ClientForm
            mode="edit"
            clientId={editTarget.id}
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
        title="Borrar cliente"
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