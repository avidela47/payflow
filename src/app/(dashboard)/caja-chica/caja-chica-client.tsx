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
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { createPettyCashMovement, deletePettyCashMovement } from "./actions";

export type PettyCashMovementItem = {
  id: string;
  dateISO: string; // "YYYY-MM-DD"
  concept: string;
  amount: number;
  type: "ingreso" | "egreso";
};

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function CajaChicaClient({
  movements,
  balance,
}: {
  movements: PettyCashMovementItem[];
  balance: number;
}) {
  const router = useRouter();

  const [type, setType] = useState<"ingreso" | "egreso">("egreso");
  const [creating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<PettyCashMovementItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const formData = new FormData(e.currentTarget);
    const result = await createPettyCashMovement(formData);
    setCreating(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Movimiento guardado.");
    (e.target as HTMLFormElement).reset();
    setType("egreso");
    router.refresh();
  }

  async function performDelete(item: PettyCashMovementItem) {
    setDeletingId(item.id);
    const result = await deletePettyCashMovement(item.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Movimiento borrado.");
    setConfirmTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">Saldo actual</p>
        <p className={balance < 0 ? "text-3xl font-semibold text-destructive" : "text-3xl font-semibold"}>
          {formatCurrency(balance)}
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <span className="text-sm font-medium">Cargar movimiento</span>

        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Tipo</Label>
              <Select
                id="type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as "ingreso" | "egreso")}
              >
                <option value="egreso">Egreso (gasto)</option>
                <option value="ingreso">Ingreso</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Fecha</Label>
              <Input id="date" name="date" type="date" required defaultValue={today()} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Monto</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="concept">Concepto</Label>
              <Input id="concept" name="concept" required placeholder="Ej: Almuerzo, fletes, insumos" />
            </div>
          </div>

          <div>
            <Button type="submit" disabled={creating}>
              {creating ? "Guardando..." : "Guardar movimiento"}
            </Button>
          </div>
        </form>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Todavía no hay movimientos cargados.
              </TableCell>
            </TableRow>
          )}
          {movements.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{formatDate(m.dateISO)}</TableCell>
              <TableCell className="font-medium">{m.concept}</TableCell>
              <TableCell>
                <Badge variant={m.type === "ingreso" ? "success" : "destructive"}>
                  {m.type === "ingreso" ? "Ingreso" : "Egreso"}
                </Badge>
              </TableCell>
              <TableCell>
                {m.type === "ingreso" ? "+" : "−"}
                {formatCurrency(m.amount)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmTarget(m)}
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
        title="Borrar movimiento"
        className="max-w-md"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar{" "}
              <span className="font-medium text-foreground">{confirmTarget.concept}</span> (
              {formatCurrency(confirmTarget.amount)})? No se puede deshacer.
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