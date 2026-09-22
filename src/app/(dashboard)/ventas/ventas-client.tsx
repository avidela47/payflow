"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
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
import { createSale, updateSale, deleteSale, setSaleCollected } from "./actions";

export type ClientOption = { id: string; nombre: string };

export type SaleItem = {
  id: string;
  clientId: string;
  clientName: string;
  saleDateISO: string; // "YYYY-MM-DD"
  paymentMethod?: string;
  expectedCollectionDateISO?: string; // "YYYY-MM-DD"
  collected: boolean;
  collectedDateISO?: string;
  amount: number;
  currency: "ARS" | "USD";
  usdAmount?: number;
  exchangeRate?: number;
  remitoNumber?: string;
  invoiceNumber?: string;
  notes?: string;
};

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Cheque", "Cuenta corriente", "Tarjeta", "Otro"];

function formatUsd(value: number): string {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
    value
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function VentasClient({ clients, sales }: { clients: ClientOption[]; sales: SaleItem[] }) {
  const router = useRouter();

  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");

  // Form de carga
  const [creating, setCreating] = useState(false);
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [usdAmount, setUsdAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");

  // Edición / borrado
  const [editing, setEditing] = useState<SaleItem | null>(null);
  const [editCurrency, setEditCurrency] = useState<"ARS" | "USD">("ARS");
  const [editUsdAmount, setEditUsdAmount] = useState("");
  const [editExchangeRate, setEditExchangeRate] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<SaleItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const today = todayISO();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((sale) => {
      const matchesMonth = !month || sale.saleDateISO.slice(0, 7) === month;
      const matchesSearch =
        !q ||
        [sale.clientName, sale.remitoNumber, sale.invoiceNumber].some((field) =>
          field?.toLowerCase().includes(q)
        );
      return matchesMonth && matchesSearch;
    });
  }, [sales, month, search]);

  const totals = useMemo(() => {
    const total = filtered.reduce((sum, s) => sum + s.amount, 0);
    const pendiente = filtered
      .filter((s) => !s.collected)
      .reduce((sum, s) => sum + s.amount, 0);
    return { total, pendiente };
  }, [filtered]);

  function saleStatus(sale: SaleItem): { label: string; variant: "success" | "destructive" | "default" } {
    if (sale.collected) return { label: "Cobrada", variant: "success" };
    if (sale.expectedCollectionDateISO && sale.expectedCollectionDateISO < today) {
      return { label: "Vencida", variant: "destructive" };
    }
    return { label: "Pendiente", variant: "default" };
  }

  function openEdit(sale: SaleItem) {
    setEditing(sale);
    setEditCurrency(sale.currency);
    setEditUsdAmount(sale.usdAmount != null ? String(sale.usdAmount) : "");
    setEditExchangeRate(sale.exchangeRate != null ? String(sale.exchangeRate) : "");
  }

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const formData = new FormData(e.currentTarget);
    const result = await createSale(formData);
    setCreating(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Venta guardada.");
    (e.target as HTMLFormElement).reset();
    setCurrency("ARS");
    setUsdAmount("");
    setExchangeRate("");
    router.refresh();
  }

  async function handleToggleCollected(sale: SaleItem) {
    setTogglingId(sale.id);
    const result = await setSaleCollected(sale.id, !sale.collected);
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
    const result = await updateSale(editing.id, formData);
    setSavingEdit(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Venta actualizada.");
    setEditing(null);
    router.refresh();
  }

  async function performDelete(sale: SaleItem) {
    setDeletingId(sale.id);
    const result = await deleteSale(sale.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Venta borrada.");
    setConfirmTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <span className="text-sm font-medium">Cargar venta</span>

        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientId">Cliente</Label>
              <select
                id="clientId"
                name="clientId"
                required
                defaultValue=""
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Elegir...
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="saleDate">Fecha de venta</Label>
              <Input id="saleDate" name="saleDate" type="date" required defaultValue={today} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentMethod">Forma de pago</Label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                defaultValue=""
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Elegir...</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expectedCollectionDate">Fecha de cobro esperada</Label>
              <Input id="expectedCollectionDate" name="expectedCollectionDate" type="date" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Moneda</Label>
              <select
                id="currency"
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "ARS" | "USD")}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="ARS">Pesos</option>
                <option value="USD">Dólares</option>
              </select>
            </div>

            {currency === "ARS" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amount">Monto</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="usdAmount">Monto en USD</Label>
                  <Input
                    id="usdAmount"
                    name="usdAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={usdAmount}
                    onChange={(e) => setUsdAmount(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="exchangeRate">Cotización ($ por USD)</Label>
                  <Input
                    id="exchangeRate"
                    name="exchangeRate"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="remitoNumber">Número de remito</Label>
              <Input id="remitoNumber" name="remitoNumber" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoiceNumber">Número de factura</Label>
              <Input id="invoiceNumber" name="invoiceNumber" />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Input id="notes" name="notes" />
            </div>
          </div>

          {currency === "USD" && Number(usdAmount) > 0 && Number(exchangeRate) > 0 && (
            <p className="text-sm text-muted-foreground">
              Equivale a {formatCurrency(Number(usdAmount) * Number(exchangeRate))}
            </p>
          )}

          <div>
            <Button type="submit" disabled={creating}>
              {creating ? "Guardando..." : "Guardar venta"}
            </Button>
          </div>
        </form>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-auto"
          />
          {month && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setMonth("")}>
              Ver todas
            </Button>
          )}
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, remito o factura..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Total {month ? "del mes" : "filtrado"}:{" "}
          <span className="font-medium text-foreground">{formatCurrency(totals.total)}</span>
        </span>
        <span>
          Pendiente de cobro:{" "}
          <span className="font-medium text-foreground">{formatCurrency(totals.pendiente)}</span>
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha venta</TableHead>
            <TableHead>Forma de pago</TableHead>
            <TableHead>Cobro esperado</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Remito</TableHead>
            <TableHead>Factura</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                {sales.length === 0 ? "Todavía no hay ventas cargadas." : "No hay ventas para este filtro."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((sale) => {
            const status = saleStatus(sale);
            return (
              <TableRow key={sale.id}>
                <TableCell className="font-medium">{sale.clientName}</TableCell>
                <TableCell>{formatDate(sale.saleDateISO)}</TableCell>
                <TableCell>{sale.paymentMethod ?? "—"}</TableCell>
                <TableCell>
                  {sale.expectedCollectionDateISO ? formatDate(sale.expectedCollectionDateISO) : "—"}
                </TableCell>
                <TableCell>
                  {formatCurrency(sale.amount)}
                  {sale.currency === "USD" && sale.usdAmount != null && sale.exchangeRate != null && (
                    <div className="text-xs text-muted-foreground">
                      U$D {formatUsd(sale.usdAmount)} × {formatUsd(sale.exchangeRate)}
                    </div>
                  )}
                </TableCell>
                <TableCell>{sale.remitoNumber ?? "—"}</TableCell>
                <TableCell>{sale.invoiceNumber ?? "—"}</TableCell>
                <TableCell>
                  <button
                    onClick={() => handleToggleCollected(sale)}
                    disabled={togglingId === sale.id}
                    title="Click para cambiar el estado"
                  >
                    <Badge variant={status.variant}>
                      {togglingId === sale.id ? "..." : status.label}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary hover:bg-primary/10"
                      onClick={() => openEdit(sale)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmTarget(sale)}
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
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing ? `Editar venta — ${editing.clientName}` : undefined}
        className="max-w-lg"
      >
        {editing && (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editClientId">Cliente</Label>
              <select
                id="editClientId"
                name="clientId"
                required
                defaultValue={editing.clientId}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editSaleDate">Fecha de venta</Label>
                <Input
                  id="editSaleDate"
                  name="saleDate"
                  type="date"
                  required
                  defaultValue={editing.saleDateISO}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editPaymentMethod">Forma de pago</Label>
                <select
                  id="editPaymentMethod"
                  name="paymentMethod"
                  defaultValue={editing.paymentMethod ?? ""}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">Elegir...</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editExpectedCollectionDate">Fecha de cobro esperada</Label>
              <Input
                id="editExpectedCollectionDate"
                name="expectedCollectionDate"
                type="date"
                defaultValue={editing.expectedCollectionDateISO ?? ""}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editCurrency">Moneda</Label>
              <select
                id="editCurrency"
                name="currency"
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value as "ARS" | "USD")}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="ARS">Pesos</option>
                <option value="USD">Dólares</option>
              </select>
            </div>

            {editCurrency === "ARS" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editAmount">Monto</Label>
                <Input
                  id="editAmount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={editing.currency === "ARS" ? editing.amount : undefined}
                />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="editUsdAmount">Monto en USD</Label>
                  <Input
                    id="editUsdAmount"
                    name="usdAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editUsdAmount}
                    onChange={(e) => setEditUsdAmount(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="editExchangeRate">Cotización ($ por USD)</Label>
                  <Input
                    id="editExchangeRate"
                    name="exchangeRate"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editExchangeRate}
                    onChange={(e) => setEditExchangeRate(e.target.value)}
                  />
                </div>
                {Number(editUsdAmount) > 0 && Number(editExchangeRate) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Equivale a {formatCurrency(Number(editUsdAmount) * Number(editExchangeRate))}
                  </p>
                )}
              </>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editRemitoNumber">Número de remito</Label>
                <Input id="editRemitoNumber" name="remitoNumber" defaultValue={editing.remitoNumber} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editInvoiceNumber">Número de factura</Label>
                <Input id="editInvoiceNumber" name="invoiceNumber" defaultValue={editing.invoiceNumber} />
              </div>
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
        title="Borrar venta"
        className="max-w-md"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar la venta a{" "}
              <span className="font-medium text-foreground">{confirmTarget.clientName}</span> del{" "}
              {formatDate(confirmTarget.saleDateISO)}? No se puede deshacer.
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