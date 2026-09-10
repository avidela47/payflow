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
import { createCheck, deleteCheck, setCheckStatus, updateCheck } from "./actions";

export type CheckStatus = "ACTIVO" | "COBRADO" | "ENDOSADO" | "DEPOSITADO" | "CADUCADO" | "OTRO";
export type CheckType = "ELECTRONICO" | "FISICO";

export type CheckItem = {
  id: string;
  type: CheckType;
  issueDateISO: string; // "YYYY-MM-DD"
  issueDateLabel: string;
  paymentDateISO: string; // "YYYY-MM-DD"
  paymentDateLabel: string;
  checkNumber: string;
  echeqId?: string;
  issuerName: string;
  issuerCuit?: string;
  issuingBank?: string;
  amount: number;
  status: CheckStatus;
  currentHolder?: string;
  requestedBy?: string;
  notes?: string;
  dueAlert?: "vencido" | "proximo";
  daysUntil?: number;
};

const STATUS_OPTIONS: { value: CheckStatus; label: string }[] = [
  { value: "ACTIVO", label: "Activo" },
  { value: "COBRADO", label: "Cobrado" },
  { value: "ENDOSADO", label: "Endosado" },
  { value: "DEPOSITADO", label: "Depositado" },
  { value: "CADUCADO", label: "Caducado" },
  { value: "OTRO", label: "Otro" },
];

const TYPE_OPTIONS: { value: CheckType; label: string }[] = [
  { value: "FISICO", label: "Físico" },
  { value: "ELECTRONICO", label: "E-cheq" },
];

function selectClass() {
  return "h-10 rounded-md border border-border bg-background px-3 text-sm";
}

function DueBadge({ item }: { item: CheckItem }) {
  if (item.dueAlert === "vencido") {
    return <Badge variant="destructive">Vencido</Badge>;
  }
  if (item.dueAlert === "proximo") {
    return (
      <Badge variant="warning">
        Vence en {item.daysUntil === 0 ? "el día" : `${item.daysUntil}d`}
      </Badge>
    );
  }
  return null;
}

function CheckFormFields({ defaultValues }: { defaultValues?: CheckItem }) {
  const [type, setType] = useState<CheckType>(defaultValues?.type ?? "FISICO");

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">Tipo</Label>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as CheckType)}
          className={selectClass()}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="checkNumber">Número de cheque</Label>
        <Input
          id="checkNumber"
          name="checkNumber"
          required
          defaultValue={defaultValues?.checkNumber}
        />
      </div>

      {type === "ELECTRONICO" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="echeqId">ID de e-cheq</Label>
          <Input id="echeqId" name="echeqId" defaultValue={defaultValues?.echeqId} />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issuerName">Librador</Label>
        <Input
          id="issuerName"
          name="issuerName"
          required
          defaultValue={defaultValues?.issuerName}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issuerCuit">CUIT librador</Label>
        <Input id="issuerCuit" name="issuerCuit" defaultValue={defaultValues?.issuerCuit} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issuingBank">Banco</Label>
        <Input id="issuingBank" name="issuingBank" defaultValue={defaultValues?.issuingBank} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Monto</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaultValues?.amount}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issueDate">Fecha de emisión</Label>
        <Input
          id="issueDate"
          name="issueDate"
          type="date"
          required
          defaultValue={defaultValues?.issueDateISO}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="paymentDate">Fecha de pago</Label>
        <Input
          id="paymentDate"
          name="paymentDate"
          type="date"
          required
          defaultValue={defaultValues?.paymentDateISO}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Estado</Label>
        <select
          id="status"
          name="status"
          defaultValue={defaultValues?.status ?? "ACTIVO"}
          className={selectClass()}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentHolder">Quién lo tiene</Label>
        <Input
          id="currentHolder"
          name="currentHolder"
          defaultValue={defaultValues?.currentHolder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="requestedBy">Quién lo pidió</Label>
        <Input id="requestedBy" name="requestedBy" defaultValue={defaultValues?.requestedBy} />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
        <Label htmlFor="notes">Notas</Label>
        <Input id="notes" name="notes" defaultValue={defaultValues?.notes} />
      </div>
    </div>
  );
}

export function ChequesClient({ checks }: { checks: CheckItem[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CheckItem | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<CheckItem | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const formData = new FormData(e.currentTarget);
    const result = await createCheck(formData);
    setCreating(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Cheque guardado.");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function handleStatusChange(check: CheckItem, status: CheckStatus) {
    setChangingStatusId(check.id);
    const result = await setCheckStatus(check.id, status);
    setChangingStatusId(null);

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
    const result = await updateCheck(editing.id, formData);
    setSavingEdit(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Cheque actualizado.");
    setEditing(null);
    router.refresh();
  }

  async function performDelete(check: CheckItem) {
    setDeletingId(check.id);
    const result = await deleteCheck(check.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Cheque borrado.");
    setConfirmTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <span className="text-sm font-medium">Cargar cheque</span>
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <CheckFormFields />
          <div>
            <Button type="submit" disabled={creating}>
              {creating ? "Guardando..." : "Guardar cheque"}
            </Button>
          </div>
        </form>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Librador</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Emisión</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {checks.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Todavía no hay cheques cargados.
              </TableCell>
            </TableRow>
          )}
          {checks.map((check) => (
            <TableRow key={check.id}>
              <TableCell>{check.type === "ELECTRONICO" ? "E-cheq" : "Físico"}</TableCell>
              <TableCell className="font-medium">{check.issuerName}</TableCell>
              <TableCell>{formatCurrency(check.amount)}</TableCell>
              <TableCell>{check.issueDateLabel}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span>{check.paymentDateLabel}</span>
                  <DueBadge item={check} />
                </div>
              </TableCell>
              <TableCell>
                <select
                  value={check.status}
                  disabled={changingStatusId === check.id}
                  onChange={(e) => handleStatusChange(check, e.target.value as CheckStatus)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-primary hover:bg-primary/10"
                    onClick={() => setEditing(check)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmTarget(check)}
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
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing ? `Editar cheque — ${editing.issuerName}` : undefined}
        className="max-w-2xl"
      >
        {editing && (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <CheckFormFields defaultValues={editing} />
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
        title="Borrar cheque"
        className="max-w-md"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar el cheque de{" "}
              <span className="font-medium text-foreground">{confirmTarget.issuerName}</span> por{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(confirmTarget.amount)}
              </span>
              ? No se puede deshacer.
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