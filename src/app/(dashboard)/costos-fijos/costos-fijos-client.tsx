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
import {
  createFixedCostCategory,
  createFixedCostEntry,
  deleteFixedCostEntry,
  setFixedCostEntryPaid,
  updateFixedCostEntry,
} from "./actions";

export type FixedCostCategoryOption = {
  id: string;
  name: string;
};

export type FixedCostEntryItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  periodISO: string; // "YYYY-MM-01"
  periodLabel: string;
  amount: number;
  paymentMode?: string;
  dueDateISO?: string; // "YYYY-MM-DD"
  dueDateLabel?: string;
  notes?: string;
  paid: boolean;
};

const PAYMENT_MODES = ["VEP", "Tarjeta", "Débito automático", "Transferencia", "Efectivo", "Otro"];
const CATEGORY_KINDS = [
  { value: "impuesto", label: "Impuesto" },
  { value: "seguro", label: "Seguro" },
  { value: "alquiler", label: "Alquiler" },
  { value: "servicio", label: "Servicio" },
  { value: "otro", label: "Otro" },
];

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isoToPeriodInput(iso: string) {
  return iso.slice(0, 7); // "YYYY-MM-01" -> "YYYY-MM"
}

export function CostosFijosClient({
  categories,
  entries,
}: {
  categories: FixedCostCategoryOption[];
  entries: FixedCostEntryItem[];
}) {
  const router = useRouter();

  // Form de carga
  const [creating, setCreating] = useState(false);
  const [categoryId, setCategoryId] = useState("");

  // Modal de nueva categoría
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  // Edición / borrado de un costo
  const [editing, setEditing] = useState<FixedCostEntryItem | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<FixedCostEntryItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const formData = new FormData(e.currentTarget);
    const result = await createFixedCostEntry(formData);
    setCreating(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Costo guardado.");
    (e.target as HTMLFormElement).reset();
    setCategoryId("");
    router.refresh();
  }

  async function handleCategorySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingCategory(true);
    const formData = new FormData(e.currentTarget);
    const result = await createFixedCostCategory(formData);
    setSavingCategory(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Categoría creada.");
    setCategoryDialogOpen(false);
    router.refresh();
  }

  async function handleTogglePaid(entry: FixedCostEntryItem) {
    setTogglingId(entry.id);
    const result = await setFixedCostEntryPaid(entry.id, !entry.paid);
    setTogglingId(null);

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
    const result = await updateFixedCostEntry(editing.id, formData);
    setSavingEdit(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Costo actualizado.");
    setEditing(null);
    router.refresh();
  }

  async function performDelete(entry: FixedCostEntryItem) {
    setDeletingId(entry.id);
    const result = await deleteFixedCostEntry(entry.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Costo borrado.");
    setConfirmTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Cargar costo</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-primary hover:bg-primary/10"
            onClick={() => setCategoryDialogOpen(true)}
          >
            + Nueva categoría
          </Button>
        </div>

        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categoryId">Categoría</Label>
              <select
                id="categoryId"
                name="categoryId"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Elegir...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="period">Período</Label>
              <Input
                id="period"
                name="period"
                type="month"
                required
                defaultValue={currentPeriod()}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Monto</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentMode">Forma de pago</Label>
              <select
                id="paymentMode"
                name="paymentMode"
                defaultValue=""
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Elegir...</option>
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dueDate">Vencimiento</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Input id="notes" name="notes" />
            </div>
          </div>

          <div>
            <Button type="submit" disabled={creating}>
              {creating ? "Guardando..." : "Guardar costo"}
            </Button>
          </div>
        </form>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoría</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Forma de pago</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Todavía no hay costos cargados.
              </TableCell>
            </TableRow>
          )}
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.categoryName}</TableCell>
              <TableCell className="capitalize">{entry.periodLabel}</TableCell>
              <TableCell>{formatCurrency(entry.amount)}</TableCell>
              <TableCell>{entry.paymentMode ?? "—"}</TableCell>
              <TableCell>{entry.dueDateLabel ?? "—"}</TableCell>
              <TableCell>
                <button
                  onClick={() => handleTogglePaid(entry)}
                  disabled={togglingId === entry.id}
                  title="Click para cambiar el estado"
                >
                  <Badge variant={entry.paid ? "success" : "default"}>
                    {togglingId === entry.id ? "..." : entry.paid ? "Pagado" : "Pendiente"}
                  </Badge>
                </button>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-primary hover:bg-primary/10"
                    onClick={() => setEditing(entry)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmTarget(entry)}
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
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        title="Nueva categoría"
        description="Impuesto, seguro, alquiler u otro gasto fijo recurrente."
        className="max-w-md"
      >
        <form onSubmit={handleCategorySubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required placeholder="Ej: Seguro ART" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kind">Tipo</Label>
            <select
              id="kind"
              name="kind"
              defaultValue=""
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">Sin especificar</option>
              {CATEGORY_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categoryNotes">Notas</Label>
            <Input id="categoryNotes" name="notes" />
          </div>
          <div>
            <Button type="submit" disabled={savingCategory}>
              {savingCategory ? "Guardando..." : "Crear categoría"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing ? `Editar ${editing.categoryName}` : undefined}
        description={editing ? editing.periodLabel : undefined}
      >
        {editing && (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editCategoryId">Categoría</Label>
              <select
                id="editCategoryId"
                name="categoryId"
                required
                defaultValue={editing.categoryId}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editPeriod">Período</Label>
              <Input
                id="editPeriod"
                name="period"
                type="month"
                required
                defaultValue={isoToPeriodInput(editing.periodISO)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editAmount">Monto</Label>
              <Input
                id="editAmount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={editing.amount}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editPaymentMode">Forma de pago</Label>
              <select
                id="editPaymentMode"
                name="paymentMode"
                defaultValue={editing.paymentMode ?? ""}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Elegir...</option>
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editDueDate">Vencimiento</Label>
              <Input
                id="editDueDate"
                name="dueDate"
                type="date"
                defaultValue={editing.dueDateISO ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editNotes">Notas</Label>
              <Input id="editNotes" name="notes" defaultValue={editing.notes} />
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
        title="Borrar costo"
        className="max-w-md"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar{" "}
              <span className="font-medium text-foreground">{confirmTarget.categoryName}</span>{" "}
              ({confirmTarget.periodLabel})? No se puede deshacer.
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