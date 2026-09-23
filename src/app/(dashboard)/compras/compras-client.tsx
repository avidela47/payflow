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
import { cn, formatCurrency } from "@/lib/utils";
import type { PurchaseReceiptStatus } from "@/models/Purchase";
import {
  createPurchase,
  updatePurchase,
  deletePurchase,
  setPurchasePaid,
  setPurchaseReceiptStatus,
} from "./actions";

export type ProviderOption = { id: string; nombre: string };

export type PurchaseItem = {
  id: string;
  providerId: string;
  providerName: string;
  purchaseDateISO: string; // "YYYY-MM-DD"
  paymentMethod?: string;
  expectedPaymentDateISO?: string; // "YYYY-MM-DD"
  paid: boolean;
  paidDateISO?: string;
  receiptStatus: PurchaseReceiptStatus;
  amount: number;
  currency: "ARS" | "USD";
  usdAmount?: number;
  exchangeRate?: number;
  remitoNumber?: string;
  invoiceNumber?: string;
  purchaseOrderNumber?: string;
  notes?: string;
};

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Cheque", "Cuenta corriente", "Tarjeta", "Otro"];

// Ciclo de estados de recepción: se click-ea el badge y va rotando en
// este orden, volviendo a "En curso" después de "Recibida total".
const RECEIPT_STATUS_CYCLE: PurchaseReceiptStatus[] = [
  "EN_CURSO",
  "RECIBIDA_PARCIAL",
  "RECIBIDA_TOTAL",
];

const RECEIPT_STATUS_LABELS: Record<PurchaseReceiptStatus, string> = {
  EN_CURSO: "En curso",
  RECIBIDA_PARCIAL: "Recibida parcial",
  RECIBIDA_TOTAL: "Recibida total",
};

const RECEIPT_STATUS_VARIANTS: Record<PurchaseReceiptStatus, "default" | "warning" | "success"> = {
  EN_CURSO: "default",
  RECIBIDA_PARCIAL: "warning",
  RECIBIDA_TOTAL: "success",
};

function nextReceiptStatus(current: PurchaseReceiptStatus): PurchaseReceiptStatus {
  const idx = RECEIPT_STATUS_CYCLE.indexOf(current);
  return RECEIPT_STATUS_CYCLE[(idx + 1) % RECEIPT_STATUS_CYCLE.length];
}

type PaymentTab = "TODAS" | "PENDIENTE" | "PAGADA" | "VENCIDA";

const PAYMENT_TABS: { key: PaymentTab; label: string }[] = [
  { key: "TODAS", label: "Todas" },
  { key: "PENDIENTE", label: "Pendiente pago" },
  { key: "PAGADA", label: "Pagada" },
  { key: "VENCIDA", label: "Vencida" },
];

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

export function ComprasClient({
  providers,
  purchases,
}: {
  providers: ProviderOption[];
  purchases: PurchaseItem[];
}) {
  const router = useRouter();

  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [paymentTab, setPaymentTab] = useState<PaymentTab>("TODAS");

  // Form de carga
  const [creating, setCreating] = useState(false);
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [usdAmount, setUsdAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");

  // Edición / borrado
  const [editing, setEditing] = useState<PurchaseItem | null>(null);
  const [editCurrency, setEditCurrency] = useState<"ARS" | "USD">("ARS");
  const [editUsdAmount, setEditUsdAmount] = useState("");
  const [editExchangeRate, setEditExchangeRate] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<PurchaseItem | null>(null);
  const [togglingPaidId, setTogglingPaidId] = useState<string | null>(null);
  const [togglingReceiptId, setTogglingReceiptId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const today = todayISO();

  function purchaseStatus(purchase: PurchaseItem): {
    label: string;
    variant: "success" | "destructive" | "default";
    tab: Exclude<PaymentTab, "TODAS">;
  } {
    if (purchase.paid) return { label: "Pagada", variant: "success", tab: "PAGADA" };
    if (purchase.expectedPaymentDateISO && purchase.expectedPaymentDateISO < today) {
      return { label: "Vencida", variant: "destructive", tab: "VENCIDA" };
    }
    return { label: "Pendiente pago", variant: "default", tab: "PENDIENTE" };
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchases.filter((purchase) => {
      const matchesMonth = !month || purchase.purchaseDateISO.slice(0, 7) === month;
      const matchesSearch =
        !q ||
        [
          purchase.providerName,
          purchase.remitoNumber,
          purchase.invoiceNumber,
          purchase.purchaseOrderNumber,
        ].some((field) => field?.toLowerCase().includes(q));
      const matchesTab = paymentTab === "TODAS" || purchaseStatus(purchase).tab === paymentTab;
      return matchesMonth && matchesSearch && matchesTab;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchases, month, search, paymentTab, today]);

  const totals = useMemo(() => {
    const total = filtered.reduce((sum, p) => sum + p.amount, 0);
    const pendiente = filtered.filter((p) => !p.paid).reduce((sum, p) => sum + p.amount, 0);
    return { total, pendiente };
  }, [filtered]);

  function openEdit(purchase: PurchaseItem) {
    setEditing(purchase);
    setEditCurrency(purchase.currency);
    setEditUsdAmount(purchase.usdAmount != null ? String(purchase.usdAmount) : "");
    setEditExchangeRate(purchase.exchangeRate != null ? String(purchase.exchangeRate) : "");
  }

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const formData = new FormData(e.currentTarget);
    const result = await createPurchase(formData);
    setCreating(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Compra guardada.");
    (e.target as HTMLFormElement).reset();
    setCurrency("ARS");
    setUsdAmount("");
    setExchangeRate("");
    router.refresh();
  }

  async function handleTogglePaid(purchase: PurchaseItem) {
    setTogglingPaidId(purchase.id);
    const result = await setPurchasePaid(purchase.id, !purchase.paid);
    setTogglingPaidId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    router.refresh();
  }

  async function handleCycleReceiptStatus(purchase: PurchaseItem) {
    setTogglingReceiptId(purchase.id);
    const result = await setPurchaseReceiptStatus(purchase.id, nextReceiptStatus(purchase.receiptStatus));
    setTogglingReceiptId(null);

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
    const result = await updatePurchase(editing.id, formData);
    setSavingEdit(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Compra actualizada.");
    setEditing(null);
    router.refresh();
  }

  async function performDelete(purchase: PurchaseItem) {
    setDeletingId(purchase.id);
    const result = await deletePurchase(purchase.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }

    toast.success("Compra borrada.");
    setConfirmTarget(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <span className="text-sm font-medium">Cargar compra</span>

        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="providerId">Proveedor</Label>
              <select
                id="providerId"
                name="providerId"
                required
                defaultValue=""
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Elegir...
                </option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchaseDate">Fecha de compra</Label>
              <Input id="purchaseDate" name="purchaseDate" type="date" required defaultValue={today} />
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
              <Label htmlFor="expectedPaymentDate">Fecha de pago esperada</Label>
              <Input id="expectedPaymentDate" name="expectedPaymentDate" type="date" />
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchaseOrderNumber">Número de orden de compra</Label>
              <Input id="purchaseOrderNumber" name="purchaseOrderNumber" />
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
              {creating ? "Guardando..." : "Guardar compra"}
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
            placeholder="Buscar por proveedor, remito, factura u OC..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PAYMENT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setPaymentTab(tab.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              paymentTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Total {month ? "del mes" : "filtrado"}:{" "}
          <span className="font-medium text-foreground">{formatCurrency(totals.total)}</span>
        </span>
        <span>
          Pendiente de pago:{" "}
          <span className="font-medium text-foreground">{formatCurrency(totals.pendiente)}</span>
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proveedor</TableHead>
            <TableHead>Fecha compra</TableHead>
            <TableHead>Forma de pago</TableHead>
            <TableHead>Pago esperado</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Remito</TableHead>
            <TableHead>Factura</TableHead>
            <TableHead>OC</TableHead>
            <TableHead>Recepción</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground">
                {purchases.length === 0
                  ? "Todavía no hay compras cargadas."
                  : "No hay compras para este filtro."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((purchase) => {
            const status = purchaseStatus(purchase);
            return (
              <TableRow key={purchase.id}>
                <TableCell className="font-medium">{purchase.providerName}</TableCell>
                <TableCell>{formatDate(purchase.purchaseDateISO)}</TableCell>
                <TableCell>{purchase.paymentMethod ?? "—"}</TableCell>
                <TableCell>
                  {purchase.expectedPaymentDateISO ? formatDate(purchase.expectedPaymentDateISO) : "—"}
                </TableCell>
                <TableCell>
                  {formatCurrency(purchase.amount)}
                  {purchase.currency === "USD" && purchase.usdAmount != null && purchase.exchangeRate != null && (
                    <div className="text-xs text-muted-foreground">
                      U$D {formatUsd(purchase.usdAmount)} × {formatUsd(purchase.exchangeRate)}
                    </div>
                  )}
                </TableCell>
                <TableCell>{purchase.remitoNumber ?? "—"}</TableCell>
                <TableCell>{purchase.invoiceNumber ?? "—"}</TableCell>
                <TableCell>{purchase.purchaseOrderNumber ?? "—"}</TableCell>
                <TableCell>
                  <button
                    onClick={() => handleCycleReceiptStatus(purchase)}
                    disabled={togglingReceiptId === purchase.id}
                    title="Click para cambiar el estado de recepción"
                  >
                    <Badge variant={RECEIPT_STATUS_VARIANTS[purchase.receiptStatus]}>
                      {togglingReceiptId === purchase.id
                        ? "..."
                        : RECEIPT_STATUS_LABELS[purchase.receiptStatus]}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleTogglePaid(purchase)}
                    disabled={togglingPaidId === purchase.id}
                    title="Click para cambiar el estado de pago"
                  >
                    <Badge variant={status.variant}>
                      {togglingPaidId === purchase.id ? "..." : status.label}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary hover:bg-primary/10"
                      onClick={() => openEdit(purchase)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmTarget(purchase)}
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
        title={editing ? `Editar compra — ${editing.providerName}` : undefined}
        className="max-w-lg"
      >
        {editing && (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editProviderId">Proveedor</Label>
              <select
                id="editProviderId"
                name="providerId"
                required
                defaultValue={editing.providerId}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editPurchaseDate">Fecha de compra</Label>
                <Input
                  id="editPurchaseDate"
                  name="purchaseDate"
                  type="date"
                  required
                  defaultValue={editing.purchaseDateISO}
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
              <Label htmlFor="editExpectedPaymentDate">Fecha de pago esperada</Label>
              <Input
                id="editExpectedPaymentDate"
                name="expectedPaymentDate"
                type="date"
                defaultValue={editing.expectedPaymentDateISO ?? ""}
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editRemitoNumber">Número de remito</Label>
                <Input id="editRemitoNumber" name="remitoNumber" defaultValue={editing.remitoNumber} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editInvoiceNumber">Número de factura</Label>
                <Input id="editInvoiceNumber" name="invoiceNumber" defaultValue={editing.invoiceNumber} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editPurchaseOrderNumber">Número de orden de compra</Label>
                <Input
                  id="editPurchaseOrderNumber"
                  name="purchaseOrderNumber"
                  defaultValue={editing.purchaseOrderNumber}
                />
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
        title="Borrar compra"
        className="max-w-md"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar la compra a{" "}
              <span className="font-medium text-foreground">{confirmTarget.providerName}</span> del{" "}
              {formatDate(confirmTarget.purchaseDateISO)}? No se puede deshacer.
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