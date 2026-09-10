"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Copy, Plus } from "lucide-react";
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
import { Dialog } from "@/components/ui/dialog";
import { createVaultEntry, updateVaultEntry, deleteVaultEntry, revealVaultEntry } from "./actions";

export type VaultEntryItem = {
  id: string;
  service: string;
  username?: string;
  link?: string;
  notes?: string;
  updatedAtLabel: string;
};

const REVEAL_TIMEOUT_MS = 20000;

export function VaultClient({ entries }: { entries: VaultEntryItem[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VaultEntryItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VaultEntryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  function hideRevealed() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setRevealedId(null);
    setRevealedValue(null);
  }

  async function handleReveal(entry: VaultEntryItem) {
    if (revealedId === entry.id) {
      hideRevealed();
      return;
    }

    setRevealingId(entry.id);
    const result = await revealVaultEntry(entry.id);
    setRevealingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    if (hideTimer.current) clearTimeout(hideTimer.current);
    setRevealedId(entry.id);
    setRevealedValue(result.value);
    hideTimer.current = setTimeout(hideRevealed, REVEAL_TIMEOUT_MS);
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copiado al portapapeles.");
    } catch {
      toast.error("No se pudo copiar. Copiala manualmente.");
    }
  }

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const formData = new FormData(e.currentTarget);
    const result = await createVaultEntry(formData);
    setCreating(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Credencial guardada.");
    setCreatingOpen(false);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    setEditing(true);
    const formData = new FormData(e.currentTarget);
    const result = await updateVaultEntry(editTarget.id, formData);
    setEditing(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Credencial actualizada.");
    setEditTarget(null);
    router.refresh();
  }

  async function performDelete(entry: VaultEntryItem) {
    setDeletingId(entry.id);
    const result = await deleteVaultEntry(entry.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    if (revealedId === entry.id) hideRevealed();
    toast.success("Credencial borrada.");
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreatingOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva credencial
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Servicio</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Clave</TableHead>
            <TableHead>Link</TableHead>
            <TableHead>Notas</TableHead>
            <TableHead>Actualizado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Todavía no hay credenciales guardadas.
              </TableCell>
            </TableRow>
          )}
          {entries.map((entry) => {
            const isRevealed = revealedId === entry.id;
            return (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.service}</TableCell>
                <TableCell>{entry.username ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {isRevealed ? (
                      <>
                        <span className="font-mono text-xs">{revealedValue}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => revealedValue && handleCopy(revealedValue)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">••••••••</span>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={revealingId === entry.id}
                      onClick={() => handleReveal(entry)}
                    >
                      {isRevealed ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      {revealingId === entry.id
                        ? "Revelando..."
                        : isRevealed
                          ? "Ocultar"
                          : "Revelar"}
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  {entry.link ? (
                      <a
                      href={entry.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Abrir
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">{entry.notes ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {entry.updatedAtLabel}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary hover:bg-primary/10"
                      onClick={() => setEditTarget(entry)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(entry)}
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
        title="Nueva credencial"
        className="max-w-md"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="service">Servicio</Label>
            <Input id="service" name="service" required placeholder="Ej: Xubio, ARCA, Banco Galicia" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Usuario</Label>
            <Input id="username" name="username" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="value">Contraseña / clave</Label>
            <Input id="value" name="value" type="password" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link">Link</Label>
            <Input id="link" name="link" placeholder="https://..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" name="notes" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreatingOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Editar credencial"
        className="max-w-md"
      >
        {editTarget && (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-service">Servicio</Label>
              <Input id="edit-service" name="service" required defaultValue={editTarget.service} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-username">Usuario</Label>
              <Input id="edit-username" name="username" defaultValue={editTarget.username} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-value">Contraseña / clave</Label>
              <Input id="edit-value" name="value" type="password" placeholder="Dejar vacío para no cambiarla" />
              <p className="text-xs text-muted-foreground">
                Se deja en blanco para mantener la clave actual sin cambios.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-link">Link</Label>
              <Input id="edit-link" name="link" defaultValue={editTarget.link} placeholder="https://..." />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-notes">Notas</Label>
              <Input id="edit-notes" name="notes" defaultValue={editTarget.notes} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editing}>
                {editing ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar credencial"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar la credencial de{" "}
              <span className="font-medium text-foreground">{deleteTarget.service}</span>? No se
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