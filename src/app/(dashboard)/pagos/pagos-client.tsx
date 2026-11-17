"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Calculator, Landmark, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import {
  gananciasConditionLabel,
  type GananciasCondition,
} from "@/lib/ganancias-conditions";
import {
  getProviderPendingPurchases,
  calculateSuggestedRetention,
  createPayment,
  deletePayment,
} from "./actions";

export type ProviderOption = {
  id: string;
  nombre: string;
  condicionGanancias: GananciasCondition | null;
};

export type RegimeOption = {
  id: string;
  codigo: string;
  concepto: string;
  alicuotaInscripto: number;
  alicuotaNoInscripto: number;
  montoNoImponible: number;
};

export type PaymentListItem = {
  id: string;
  providerName: string;
  paymentDateISO: string;
  grossAmount: number;
  regimeCode: string;
  withheldGanancias: number;
  retentionIIBB: number;
  retentionOther: number;
  totalPaid: number;
  invoiceNumbers: string[];
  checksSummary: { bank: string; checkNumber: string; amount: number; paymentDateISO: string }[];
  voucherNumber?: string;
  paymentOrderNumber?: string;
};

type PendingPurchase = { id: string; invoiceNumber: string; purchaseDate: string; amount: number };
type CheckRow = { type: "FISICO" | "ELECTRONICO"; bank: string; checkNumber: string; paymentDate: string; amount: string };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso)
  );
}

function emptyCheckRow(): CheckRow {
  return { type: "FISICO", bank: "", checkNumber: "", paymentDate: "", amount: "" };
}

// ---------- formulario de "Nuevo pago" ----------

function PaymentForm({
  providers,
  regimes,
  onDone,
}: {
  providers: ProviderOption[];
  regimes: RegimeOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayStr());
  const [condicionGanancias, setCondicionGanancias] = useState<GananciasCondition | null>(null);
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Set<string>>(new Set());
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [regimeCode, setRegimeCode] = useState(regimes[0]?.codigo ?? "");
  const [grossAmount, setGrossAmount] = useState("0");
  const [calculating, setCalculating] = useState(false);
  const [nonTaxableAmountUsed, setNonTaxableAmountUsed] = useState("0");
  const [rateUsed, setRateUsed] = useState("0");
  const [priorMonthGross, setPriorMonthGross] = useState("0");
  const [priorMonthWithheld, setPriorMonthWithheld] = useState("0");
  const [withheldAmount, setWithheldAmount] = useState("0");
  const [retentionIIBB, setRetentionIIBB] = useState("0");
  const [retentionOther, setRetentionOther] = useState("0");
  const [voucherNumber, setVoucherNumber] = useState("");
  const [paymentOrderNumber, setPaymentOrderNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState<CheckRow[]>([emptyCheckRow()]);

  // Al cambiar de proveedor: traer sus compras pendientes + su condición
  // frente a Ganancias, y arrancar de nuevo la selección.
  useEffect(() => {
    if (!providerId) {
      setPendingPurchases([]);
      setCondicionGanancias(null);
      setSelectedPurchaseIds(new Set());
      return;
    }
    setLoadingPurchases(true);
    getProviderPendingPurchases(providerId).then((result) => {
      setLoadingPurchases(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCondicionGanancias(result.condicionGanancias);
      setPendingPurchases(
        result.purchases.map((p) => ({
          id: p.id,
          invoiceNumber: p.invoiceNumber,
          purchaseDate: p.purchaseDate,
          amount: p.amount,
        }))
      );
      setSelectedPurchaseIds(new Set());
    });
  }, [providerId]);

  // El bruto se resincroniza con la suma de lo tildado cada vez que cambia
  // la selección — se puede seguir editando a mano después, hasta la
  // próxima vez que se tilde/destilde algo.
  useEffect(() => {
    const sum = pendingPurchases
      .filter((p) => selectedPurchaseIds.has(p.id))
      .reduce((acc, p) => acc + p.amount, 0);
    setGrossAmount(String(sum));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPurchaseIds]);

  function togglePurchase(id: string) {
    setSelectedPurchaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCalculate() {
    if (!providerId || !regimeCode) {
      toast.error("Elegí proveedor y régimen primero.");
      return;
    }
    setCalculating(true);
    const result = await calculateSuggestedRetention({
      providerId,
      regimeCode,
      grossAmount: Number(grossAmount) || 0,
      condicionGanancias,
      paymentDate,
    });
    setCalculating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setNonTaxableAmountUsed(String(result.nonTaxableAmountUsed));
    setRateUsed(String(result.rateUsed));
    setPriorMonthGross(String(result.priorMonthGross));
    setPriorMonthWithheld(String(result.priorMonthWithheld));
    setWithheldAmount(String(result.withheldAmount));
    toast.success("Retención sugerida calculada — revisala antes de guardar.");
  }

  function updateCheckRow(index: number, patch: Partial<CheckRow>) {
    setChecks((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addCheckRow() {
    setChecks((prev) => [...prev, emptyCheckRow()]);
  }

  function removeCheckRow(index: number) {
    setChecks((prev) => prev.filter((_, i) => i !== index));
  }

  const totalRetentions = (Number(withheldAmount) || 0) + (Number(retentionIIBB) || 0) + (Number(retentionOther) || 0);
  const totalToPay = (Number(grossAmount) || 0) - totalRetentions;
  const totalChecks = checks.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
  const checksMismatch = checks.some((r) => r.checkNumber) && Math.abs(totalChecks - totalToPay) > 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedPurchaseIds.size === 0) {
      toast.error("Elegí al menos una compra a saldar.");
      return;
    }
    const validChecks = checks.filter((c) => c.checkNumber && c.paymentDate && c.amount);
    if (validChecks.length === 0) {
      toast.error("Agregá al menos un cheque con número, fecha e importe.");
      return;
    }

    const fd = new FormData();
    fd.set("providerId", providerId);
    fd.set("paymentDate", paymentDate);
    for (const id of selectedPurchaseIds) fd.append("purchaseIds", id);
    fd.set("grossAmount", grossAmount);
    fd.set("regimeCode", regimeCode);
    fd.set("condicionGanancias", condicionGanancias ?? "");
    fd.set("nonTaxableAmountUsed", nonTaxableAmountUsed);
    fd.set("rateUsed", rateUsed);
    fd.set("priorMonthGross", priorMonthGross);
    fd.set("priorMonthWithheld", priorMonthWithheld);
    fd.set("withheldAmount", withheldAmount);
    fd.set("retentionIIBB", retentionIIBB);
    fd.set("retentionOther", retentionOther);
    fd.set("voucherNumber", voucherNumber);
    fd.set("paymentOrderNumber", paymentOrderNumber);
    fd.set("notes", notes);
    for (const row of validChecks) {
      fd.append("checkType", row.type);
      fd.append("checkBank", row.bank);
      fd.append("checkNumber", row.checkNumber);
      fd.append("checkPaymentDate", row.paymentDate);
      fd.append("checkAmount", row.amount);
    }

    setSaving(true);
    const result = await createPayment(fd);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Pago registrado.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="providerId">Proveedor</Label>
          <Select id="providerId" value={providerId} onChange={(e) => setProviderId(e.target.value)} required>
            <option value="">Elegí un proveedor</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
          {providerId && (
            <p className="text-xs text-muted-foreground">
              Ganancias:{" "}
              {condicionGanancias
                ? gananciasConditionLabel(condicionGanancias)
                : "sin especificar (cargalo en Proveedores para calcular bien la retención)"}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paymentDate">Fecha de pago</Label>
          <Input
            id="paymentDate"
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Facturas pendientes que salda este pago</Label>
        {!providerId ? (
          <p className="text-sm text-muted-foreground">Elegí un proveedor para ver sus compras pendientes.</p>
        ) : loadingPurchases ? (
          <p className="text-sm text-muted-foreground">Buscando compras pendientes…</p>
        ) : pendingPurchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este proveedor no tiene compras pendientes de pago.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            {pendingPurchases.map((p) => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedPurchaseIds.has(p.id)}
                  onChange={() => togglePurchase(p.id)}
                />
                <span className="flex-1 truncate">
                  {p.invoiceNumber ? `FAC ${p.invoiceNumber}` : "Sin número de factura"} ·{" "}
                  {formatDate(p.purchaseDate)}
                </span>
                <span className="font-medium">{formatCurrency(p.amount)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="grossAmount">Importe pagado sujeto a retención</Label>
          <Input
            id="grossAmount"
            type="number"
            step="0.01"
            min="0"
            value={grossAmount}
            onChange={(e) => setGrossAmount(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="regimeCode">Régimen (Ganancias)</Label>
          <Select id="regimeCode" value={regimeCode} onChange={(e) => setRegimeCode(e.target.value)}>
            {regimes.length === 0 && <option value="">Sin regímenes cargados</option>}
            {regimes.map((r) => (
              <option key={r.id} value={r.codigo}>
                {r.codigo} — {r.concepto}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Retención de Ganancias</span>
          <div className="flex items-center gap-2">
            <a
              href="https://servicioscf.afip.gob.ar/calc-rg830/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir calculadora oficial (ARCA)
            </a>
            <Button type="button" variant="outline" size="sm" onClick={handleCalculate} disabled={calculating}>
              <Calculator className="h-4 w-4" />
              {calculating ? "Calculando..." : "Calcular sugerida"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Sugerencia editable, no un cálculo oficial — confirmala contra la calculadora de ARCA (RG 830) o
          con la contadora antes de usarla en un pago real.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="nonTaxableAmountUsed" className="text-xs">
              Mínimo no imponible
            </Label>
            <Input
              id="nonTaxableAmountUsed"
              type="number"
              step="0.01"
              value={nonTaxableAmountUsed}
              onChange={(e) => setNonTaxableAmountUsed(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="rateUsed" className="text-xs">
              Alícuota (%)
            </Label>
            <Input
              id="rateUsed"
              type="number"
              step="0.01"
              value={rateUsed}
              onChange={(e) => setRateUsed(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="priorMonthGross" className="text-xs">
              Acumulado del mes
            </Label>
            <Input
              id="priorMonthGross"
              type="number"
              step="0.01"
              value={priorMonthGross}
              onChange={(e) => setPriorMonthGross(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="priorMonthWithheld" className="text-xs">
              Ya retenido el mes
            </Label>
            <Input
              id="priorMonthWithheld"
              type="number"
              step="0.01"
              value={priorMonthWithheld}
              onChange={(e) => setPriorMonthWithheld(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="withheldAmount">Importe retenido (Ganancias)</Label>
          <Input
            id="withheldAmount"
            type="number"
            step="0.01"
            min="0"
            value={withheldAmount}
            onChange={(e) => setWithheldAmount(e.target.value)}
            className="font-semibold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="retentionIIBB">Retención Ingresos Brutos</Label>
          <Input
            id="retentionIIBB"
            type="number"
            step="0.01"
            min="0"
            value={retentionIIBB}
            onChange={(e) => setRetentionIIBB(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="retentionOther">Otras retenciones</Label>
          <Input
            id="retentionOther"
            type="number"
            step="0.01"
            min="0"
            value={retentionOther}
            onChange={(e) => setRetentionOther(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Cheques del pago</Label>
          <Button type="button" variant="outline" size="sm" onClick={addCheckRow}>
            <Plus className="h-4 w-4" />
            Agregar cheque
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {checks.map((row, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 sm:grid-cols-6">
              <Select
                value={row.type}
                onChange={(e) => updateCheckRow(i, { type: e.target.value as CheckRow["type"] })}
                className="sm:col-span-1"
              >
                <option value="FISICO">Físico</option>
                <option value="ELECTRONICO">E-cheq</option>
              </Select>
              <Input
                placeholder="Banco"
                value={row.bank}
                onChange={(e) => updateCheckRow(i, { bank: e.target.value })}
                className="sm:col-span-1"
              />
              <Input
                placeholder="Número"
                value={row.checkNumber}
                onChange={(e) => updateCheckRow(i, { checkNumber: e.target.value })}
                className="sm:col-span-1"
              />
              <Input
                type="date"
                value={row.paymentDate}
                onChange={(e) => updateCheckRow(i, { paymentDate: e.target.value })}
                className="sm:col-span-1"
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Importe"
                value={row.amount}
                onChange={(e) => updateCheckRow(i, { amount: e.target.value })}
                className="sm:col-span-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 sm:col-span-1"
                onClick={() => removeCheckRow(i)}
                disabled={checks.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <p className={checksMismatch ? "text-xs text-warning" : "text-xs text-muted-foreground"}>
          Cheques cargados: {formatCurrency(totalChecks)} · Neto a pagar: {formatCurrency(totalToPay)}
          {checksMismatch ? " — no coinciden, revisá los importes." : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="voucherNumber">Nro. comprobante de retención</Label>
          <Input id="voucherNumber" value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paymentOrderNumber">Nro. orden de pago</Label>
          <Input
            id="paymentOrderNumber"
            value={paymentOrderNumber}
            onChange={(e) => setPaymentOrderNumber(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Bruto</span>
          <span>{formatCurrency(Number(grossAmount) || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Retenciones totales</span>
          <span>-{formatCurrency(totalRetentions)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Neto a pagar</span>
          <span>{formatCurrency(totalToPay)}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Registrar pago"}
        </Button>
      </div>
    </form>
  );
}

// ---------- catálogo de regímenes (chiquito, dentro de un Dialog aparte) ----------

// ---------- componente principal ----------

export function PagosClient({
  payments,
  providers,
  regimes,
  pendingPurchasesCount,
  emittedChecksCount,
}: {
  payments: PaymentListItem[];
  providers: ProviderOption[];
  regimes: RegimeOption[];
  pendingPurchasesCount: number;
  emittedChecksCount: number;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function performDelete(payment: PaymentListItem) {
    setDeleting(true);
    const result = await deletePayment(payment.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Ocurrió un error.");
      return;
    }
    toast.success("Pago borrado — las compras que saldaba vuelven a quedar pendientes.");
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Compras pendientes de pago</p>
              <p className="text-lg font-semibold">{pendingPurchasesCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cheques emitidos (total)</p>
              <p className="text-lg font-semibold">{emittedChecksCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {regimes.length === 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          Todavía no hay ningún régimen de retención cargado — antes de registrar un pago, pedime que
          cargue el código 78 (Compra de bienes) en la base, con los % que confirmes.
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={() => setFormOpen(true)} disabled={providers.length === 0}>
          <Plus className="h-4 w-4" />
          Nuevo pago
        </Button>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Todavía no registraste ningún pago.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Facturas</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Ret. Ganancias</TableHead>
              <TableHead className="text-right">Neto pagado</TableHead>
              <TableHead className="text-right">Cheques</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="text-muted-foreground">{formatDate(payment.paymentDateISO)}</TableCell>
                <TableCell className="font-medium">{payment.providerName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {payment.invoiceNumbers.length > 0 ? payment.invoiceNumbers.join(", ") : "—"}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(payment.grossAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(payment.withheldGanancias)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(payment.totalPaid)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {payment.checksSummary.length}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(payment)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Nuevo pago a proveedor"
        className="max-w-3xl"
      >
        {formOpen && <PaymentForm providers={providers} regimes={regimes} onDone={() => setFormOpen(false)} />}
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Borrar pago"
        className="max-w-md"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que querés borrar el pago a{" "}
              <span className="font-medium text-foreground">{deleteTarget.providerName}</span> del{" "}
              {formatDate(deleteTarget.paymentDateISO)}? Las facturas que saldaba vuelven a quedar
              pendientes y se borran los cheques que había creado. No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={() => performDelete(deleteTarget)}
              >
                {deleting ? "Borrando..." : "Sí, borrar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}