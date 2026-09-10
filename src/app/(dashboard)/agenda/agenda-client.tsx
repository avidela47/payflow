"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { createAgendaEntry, deleteAgendaEntry, sendAgendaDigestNow } from "./actions";

export type AgendaEntryItem = {
  id: string;
  title: string;
  dateISO: string; // "YYYY-MM-DD"
  dateLabel: string;
  notes?: string;
  sent: boolean;
};

export function AgendaClient({ entries }: { entries: AgendaEntryItem[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<AgendaEntryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingNow, setSendingNow] = useState(false);

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const formData = new FormData(e.currentTarget);
    const result = await createAgendaEntry(formData);
    setCreating(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Recordatorio guardado.");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function performDelete(entry: AgendaEntryItem) {
    setDeletingId(entry.id);
    const result = await deleteAgendaEntry(entry.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Recordatorio borrado.");
    setConfirmTarget(null);
    router.refresh();
  }

  async function handleSendNow() {
    setSendingNow(true);
    const result = await sendAgendaDigestNow();
    setSendingNow(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success(result.message ?? "Listo.");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-sm font-medium">Nuevo recordatorio</span>
            <p className="text-xs text-muted-foreground">
              El mail del día también suma solo, automáticamente, los cheques y costos fijos que
              venzan esa fecha — no hace falta cargarlos acá de nuevo.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={sendingNow}
            onClick={handleSendNow}
          >
            {sendingNow ? "Enviando..." : "Enviar ahora (prueba)"}
          </Button>
        </div>

        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" name="title" required placeholder="Ej: Renovar seguro ART" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Fecha</Label>
              <Input id="date" name="date" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <Label htmlFor="notes">Notas</Label>
              <Input id="notes" name="notes" />
            </div>
          </div>
          <div>
            <Button type="submit" disabled={creating}>
              {creating ? "Guardando..." : "Guardar recordatorio"}
            </Button>
          </div>
        </form>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Notas</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Todavía no hay recordatorios cargados.
              </TableCell>
            </TableRow>
          )}
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.title}</TableCell>
              <TableCell>{entry.dateLabel}</TableCell>
              <TableCell>{entry.notes ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={entry.sent ? "success" : "default"}>
                  {entry.sent ? "Avisado" : "Pendiente"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmTarget(entry)}
                >
                  Borrar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title="Borrar recordatorio"
        className="max-w-md"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar{" "}
              <span className="font-medium text-foreground">{confirmTarget.title}</span> (
              {confirmTarget.dateLabel})? No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deletingId === confirmTarget.id}
                onClick={() => performDelete(confirmTarget)}
              >
                {deletingId === confirmTarget.id ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}