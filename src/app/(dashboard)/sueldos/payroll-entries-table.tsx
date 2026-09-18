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
import { formatCurrency } from "@/lib/utils";
import { MaskedAmount } from "@/components/masked-amount";
import { setPayrollGroupPaid, updatePayrollGroup, deletePayrollGroup } from "./actions";

// Una fila = un empleado + un período, con el total combinado de
// registrado + informal. El desglose se ve al hacer click en el nombre.
export type PayrollGroupItem = {
  employeeId: string;
  periodISO: string;
  employeeName: string;
  periodLabel: string;
  registradoAmount: number;
  informalAmount: number;
  total: number;
  paidBy?: string;
  notes?: string;
  paid: boolean;
};

function groupKey(g: { employeeId: string; periodISO: string }) {
  return `${g.employeeId}-${g.periodISO}`;
}

export function PayrollEntriesTable({ groups }: { groups: PayrollGroupItem[] }) {
  const router = useRouter();
  const [breakdownTarget, setBreakdownTarget] = useState<PayrollGroupItem | null>(null);
  const [editing, setEditing] = useState<PayrollGroupItem | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<PayrollGroupItem | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleTogglePaid(group: PayrollGroupItem) {
    const key = groupKey(group);
    setTogglingKey(key);
    const result = await setPayrollGroupPaid(group.employeeId, group.periodISO, !group.paid);
    setTogglingKey(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    router.refresh();
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;

    setSavingEdit(true);
    const formData = new FormData(e.currentTarget);
    const result = await updatePayrollGroup(editing.employeeId, editing.periodISO, formData);
    setSavingEdit(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Pago actualizado.");
    setEditing(null);
    router.refresh();
  }

  async function performDelete(group: PayrollGroupItem) {
    const key = groupKey(group);
    setDeletingKey(key);
    const result = await deletePayrollGroup(group.employeeId, group.periodISO);
    setDeletingKey(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Pago borrado.");
    setConfirmTarget(null);
    router.refresh();
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Lo paga</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Todavía no hay pagos registrados.
              </TableCell>
            </TableRow>
          )}
          {groups.map((group) => {
            const key = groupKey(group);

            return (
              <TableRow key={key}>
                <TableCell className="font-medium">
                  <button
                    type="button"
                    className="cursor-pointer rounded transition-colors hover:text-primary"
                    onClick={() => setBreakdownTarget(group)}
                  >
                    {group.employeeName}
                  </button>
                </TableCell>
                <TableCell className="capitalize">{group.periodLabel}</TableCell>
                <TableCell>
                  <MaskedAmount value={formatCurrency(group.total)} />
                </TableCell>
                <TableCell>{group.paidBy ?? "—"}</TableCell>
                <TableCell>
                  <button
                    onClick={() => handleTogglePaid(group)}
                    disabled={togglingKey === key}
                    title="Click para cambiar el estado"
                  >
                    <Badge variant={group.paid ? "success" : "default"}>
                      {togglingKey === key ? "..." : group.paid ? "Pagado" : "Pendiente"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary hover:bg-primary/10"
                      onClick={() => setEditing(group)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmTarget(group)}
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
        open={breakdownTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBreakdownTarget(null);
        }}
        title={breakdownTarget ? breakdownTarget.employeeName : undefined}
        description={breakdownTarget ? breakdownTarget.periodLabel : undefined}
        className="max-w-xs"
      >
        {breakdownTarget && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Registrado</span>
              <MaskedAmount value={formatCurrency(breakdownTarget.registradoAmount)} />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Informal</span>
              <MaskedAmount value={formatCurrency(breakdownTarget.informalAmount)} />
            </div>
            <div className="mt-2 flex justify-between gap-4 border-t border-border pt-2 font-medium">
              <span>Total</span>
              <MaskedAmount value={formatCurrency(breakdownTarget.total)} />
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing ? `${editing.employeeName} — ${editing.periodLabel}` : undefined}
        description="Editar registrado e informal de este período."
      >
        {editing && (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="registradoAmount">Registrado</Label>
              <Input
                id="registradoAmount"
                name="registradoAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editing.registradoAmount}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="informalAmount">Informal</Label>
              <Input
                id="informalAmount"
                name="informalAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editing.informalAmount}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paidBy">Lo paga</Label>
              <Input id="paidBy" name="paidBy" defaultValue={editing.paidBy} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notas</Label>
              <Input id="notes" name="notes" defaultValue={editing.notes} />
            </div>
            <div>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title="Borrar pago"
        className="max-w-md"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar el pago de{" "}
              <span className="font-medium text-foreground">{confirmTarget.employeeName}</span>{" "}
              ({confirmTarget.periodLabel})? Se borran registrado e informal juntos. No se puede
              deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deletingKey === groupKey(confirmTarget)}
                onClick={() => performDelete(confirmTarget)}
              >
                {deletingKey === groupKey(confirmTarget) ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}