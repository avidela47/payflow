import { connectDB } from "@/lib/db";
import { PayrollEntry } from "@/models/PayrollEntry";
import { FixedCostEntry } from "@/models/FixedCost";
import { Sale } from "@/models/Sale";
import { Purchase, type PurchaseReceiptStatus } from "@/models/Purchase";
import { formatPeriod } from "@/lib/utils";
// Import "silencioso": PayrollEntry.employee referencia el modelo
// "Employee" por nombre, pero acá nunca importamos ese archivo aparte
// (solo usamos el doc ya populado). Si nada más en el bundle de esta
// página importó @/models/Employee, Mongoose no tiene el schema
// registrado y populate("employee") explota con MissingSchemaError. Este
// import fuerza el registro aunque no usemos el símbolo directamente.
import "@/models/Employee";
// Mismo motivo, para Sale.client → "Client".
import "@/models/Client";
// Mismo motivo, para Purchase.provider → "Provider".
import "@/models/Provider";

// Mismo criterio que ya usan sueldos/costos-fijos: el período se guarda
// siempre como el día 1 del mes, construido en hora local — así evitamos
// que cambie de día por husos horarios.
export function periodStringToDate(periodISO: string): Date {
  const [year, month] = periodISO.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function currentPeriodString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Lista de "YYYY-MM" entre dos períodos, inclusive. Si vienen invertidos
// los reordena solo. Tope de 60 meses como salvavidas ante un rango mal
// tipeado.
export function periodRange(fromISO: string, toISO: string): string[] {
  let from = fromISO;
  let to = toISO;
  if (from > to) {
    [from, to] = [to, from];
  }

  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);

  const months: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (months.length > 60) break;
  }
  return months;
}

// ---------- Reporte de Sueldos ----------

export type PayrollReportRow = {
  employeeId: string;
  employeeName: string;
  monotributo: number;
  registrado: number;
  informal: number;
  informalLabel: "Informal" | "Viáticos";
  total: number;
};

export type PayrollReportResult = {
  periodISO: string;
  periodLabel: string;
  rows: PayrollReportRow[];
  totals: { monotributo: number; registrado: number; informal: number; total: number };
};

export async function getPayrollReport(periodISO: string): Promise<PayrollReportResult> {
  await connectDB();
  const period = periodStringToDate(periodISO);

  const entries = await PayrollEntry.find({ period }).populate("employee").lean();

  const rowsByEmployee = new Map<string, PayrollReportRow>();

  for (const entry of entries) {
    const employeeDoc =
      entry.employee && typeof entry.employee === "object" && "nombre" in entry.employee
        ? (entry.employee as unknown as {
            _id: { toString(): string };
            nombre: string;
            apellido: string;
            category: "MONOTRIBUTISTA" | "EMPLEADO";
            paymentType?: "FIJO" | "POR_HORA";
          })
        : null;

    // Igual que en sueldos/page.tsx: si el empleado fue borrado, Mongoose
    // deja `entry.employee` en null (no el id crudo) — usamos el id de la
    // propia liquidación como clave para no crashear.
    const employeeId = employeeDoc
      ? employeeDoc._id.toString()
      : `huerfano-${entry._id.toString()}`;
    const employeeName = employeeDoc
      ? `${employeeDoc.apellido}, ${employeeDoc.nombre}`
      : "Empleado eliminado";
    const isMonotributista = employeeDoc?.category === "MONOTRIBUTISTA";
    const isPorHora = employeeDoc?.paymentType === "POR_HORA";

    const row: PayrollReportRow =
      rowsByEmployee.get(employeeId) ?? {
        employeeId,
        employeeName,
        monotributo: 0,
        registrado: 0,
        informal: 0,
        informalLabel: isMonotributista || isPorHora ? "Viáticos" : "Informal",
        total: 0,
      };

    if (entry.modality === "REGISTRADO") {
      if (isMonotributista) {
        row.monotributo += entry.amount;
      } else {
        row.registrado += entry.amount;
      }
    } else {
      row.informal += entry.amount;
    }
    row.total = row.monotributo + row.registrado + row.informal;

    rowsByEmployee.set(employeeId, row);
  }

  const rows = Array.from(rowsByEmployee.values()).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, "es")
  );

  const totals = rows.reduce(
    (acc, row) => ({
      monotributo: acc.monotributo + row.monotributo,
      registrado: acc.registrado + row.registrado,
      informal: acc.informal + row.informal,
      total: acc.total + row.total,
    }),
    { monotributo: 0, registrado: 0, informal: 0, total: 0 }
  );

  return { periodISO, periodLabel: formatPeriod(period), rows, totals };
}

// ---------- Reporte de Costos Fijos / Gastos ----------

export type FixedCostSummaryRow = {
  categoryId: string;
  categoryName: string;
  amountsByPeriod: Record<string, number>;
  total: number;
};

export type FixedCostDetailRow = {
  id: string;
  categoryName: string;
  periodISO: string;
  periodLabel: string;
  amount: number;
  paymentMode?: string;
  dueDate?: Date;
  paid: boolean;
};

export type FixedCostReportResult = {
  fromISO: string;
  toISO: string;
  months: string[];
  summary: FixedCostSummaryRow[];
  summaryTotalsByPeriod: Record<string, number>;
  grandTotal: number;
  detail: FixedCostDetailRow[];
};

export async function getFixedCostReport(
  fromISO: string,
  toISO: string
): Promise<FixedCostReportResult> {
  await connectDB();
  const months = periodRange(fromISO, toISO);
  const fromDate = periodStringToDate(months[0] ?? fromISO);
  const toDate = periodStringToDate(months[months.length - 1] ?? toISO);

  const entries = await FixedCostEntry.find({ period: { $gte: fromDate, $lte: toDate } })
    .populate("category")
    .sort({ period: 1, createdAt: 1 })
    .lean();

  const summaryByCategory = new Map<string, FixedCostSummaryRow>();
  const summaryTotalsByPeriod: Record<string, number> = {};
  for (const m of months) summaryTotalsByPeriod[m] = 0;
  let grandTotal = 0;
  const detail: FixedCostDetailRow[] = [];

  for (const entry of entries) {
    const categoryDoc =
      entry.category && typeof entry.category === "object" && "name" in entry.category
        ? (entry.category as unknown as { _id: { toString(): string }; name: string })
        : null;
    // Borrar una categoría en uso está bloqueado en costos-fijos/actions.ts,
    // así que esto no debería pasar — pero si alguna vez pasa (ej. borrado
    // manual en Atlas), mejor un id de respaldo que un crash por null.
    const categoryId = categoryDoc
      ? categoryDoc._id.toString()
      : `huerfano-${entry._id.toString()}`;
    const categoryName = categoryDoc?.name ?? "Categoría eliminada";

    const periodDate = entry.period as Date;
    const periodISO = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    const row =
      summaryByCategory.get(categoryId) ??
      ({
        categoryId,
        categoryName,
        amountsByPeriod: {},
        total: 0,
      } as FixedCostSummaryRow);
    row.amountsByPeriod[periodISO] = (row.amountsByPeriod[periodISO] ?? 0) + entry.amount;
    row.total += entry.amount;
    summaryByCategory.set(categoryId, row);

    summaryTotalsByPeriod[periodISO] = (summaryTotalsByPeriod[periodISO] ?? 0) + entry.amount;
    grandTotal += entry.amount;

    detail.push({
      id: entry._id.toString(),
      categoryName,
      periodISO,
      periodLabel: formatPeriod(periodDate),
      amount: entry.amount,
      paymentMode: entry.paymentMode,
      dueDate: entry.dueDate,
      paid: entry.paid,
    });
  }

  const summary = Array.from(summaryByCategory.values()).sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName, "es")
  );

  return {
    fromISO: months[0] ?? fromISO,
    toISO: months[months.length - 1] ?? toISO,
    months,
    summary,
    summaryTotalsByPeriod,
    grandTotal,
    detail,
  };
}

// ---------- Reporte de Ventas ----------

// A diferencia de Sueldos/Costos Fijos, Sale no tiene un campo `period`
// fijo al día 1 del mes: cada venta tiene su propia `saleDate` real. Por
// eso el filtro por mes acá es un rango [from, to) sobre esa fecha, no una
// igualdad exacta.
//
// El estado cobrado/pendiente que se muestra es SIEMPRE el actual (en
// vivo), no una foto congelada al cierre del mes: si una venta de este
// período se cobra más adelante (ej. un cheque que se hace efectivo el
// mes que viene), `collected`/`collectedDate` se actualizan en el momento
// en Ventas y este reporte, si se vuelve a abrir después, ya la va a
// mostrar como cobrada. El reporte no intenta "cerrar" el mes.
export type SalesPaymentMethodRow = {
  method: string;
  count: number;
  amount: number;
};

export type SalesReportDetailRow = {
  id: string;
  clientName: string;
  saleDateISO: string;
  paymentMethod?: string;
  amount: number;
  collected: boolean;
  collectedDateISO?: string;
  invoiceNumber?: string;
};

export type SalesReportResult = {
  periodISO: string;
  periodLabel: string;
  totalCount: number;
  totalAmount: number;
  collectedCount: number;
  collectedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  byPaymentMethod: SalesPaymentMethodRow[];
  detail: SalesReportDetailRow[];
};

export async function getSalesReport(periodISO: string): Promise<SalesReportResult> {
  await connectDB();
  const from = periodStringToDate(periodISO);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);

  const sales = await Sale.find({ saleDate: { $gte: from, $lt: to } })
    .populate("client")
    .sort({ saleDate: 1 })
    .lean();

  let totalAmount = 0;
  let collectedCount = 0;
  let collectedAmount = 0;
  let pendingCount = 0;
  let pendingAmount = 0;
  const methodMap = new Map<string, SalesPaymentMethodRow>();
  const detail: SalesReportDetailRow[] = [];

  for (const sale of sales) {
    // Mismo caso que en ventas/page.tsx: si el cliente fue borrado,
    // Mongoose deja `sale.client` en null (no el id crudo).
    const clientDoc =
      sale.client && typeof sale.client === "object" && "nombre" in sale.client
        ? (sale.client as unknown as { nombre: string })
        : null;
    const clientName = clientDoc?.nombre ?? "Cliente eliminado";

    totalAmount += sale.amount;
    if (sale.collected) {
      collectedCount += 1;
      collectedAmount += sale.amount;
    } else {
      pendingCount += 1;
      pendingAmount += sale.amount;
    }

    const methodKey = sale.paymentMethod || "Sin especificar";
    const methodRow = methodMap.get(methodKey) ?? { method: methodKey, count: 0, amount: 0 };
    methodRow.count += 1;
    methodRow.amount += sale.amount;
    methodMap.set(methodKey, methodRow);

    detail.push({
      id: sale._id.toString(),
      clientName,
      saleDateISO: sale.saleDate.toISOString().slice(0, 10),
      paymentMethod: sale.paymentMethod,
      amount: sale.amount,
      collected: sale.collected,
      collectedDateISO: sale.collectedDate
        ? sale.collectedDate.toISOString().slice(0, 10)
        : undefined,
      invoiceNumber: sale.invoiceNumber,
    });
  }

  const byPaymentMethod = Array.from(methodMap.values()).sort((a, b) => b.amount - a.amount);

  return {
    periodISO,
    periodLabel: formatPeriod(from),
    totalCount: sales.length,
    totalAmount,
    collectedCount,
    collectedAmount,
    pendingCount,
    pendingAmount,
    byPaymentMethod,
    detail,
  };
}

// ---------- Reporte de Compras ----------

// Mismo criterio que Ventas: Purchase tampoco tiene un campo `period` fijo
// al día 1 del mes, así que el filtro por mes es un rango [from, to) sobre
// `purchaseDate`. El estado de pago mostrado es siempre el actual (en
// vivo), no una foto congelada al cierre del mes — misma filosofía que
// Ventas, ver comentario más arriba.
//
// A diferencia de Ventas, acá hay una dimensión extra: el estado de
// recepción (en curso / recibida parcial / recibida total), independiente
// del estado de pago — se desglosa aparte en `byReceiptStatus`.
export type PurchasesPaymentMethodRow = {
  method: string;
  count: number;
  amount: number;
};

export type PurchasesReceiptStatusRow = {
  status: PurchaseReceiptStatus;
  count: number;
  amount: number;
};

export type PurchasesReportDetailRow = {
  id: string;
  providerName: string;
  purchaseDateISO: string;
  paymentMethod?: string;
  amount: number;
  paid: boolean;
  paidDateISO?: string;
  receiptStatus: PurchaseReceiptStatus;
  invoiceNumber?: string;
};

export type PurchasesReportResult = {
  periodISO: string;
  periodLabel: string;
  totalCount: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  pendingCount: number;
  pendingAmount: number;
  byPaymentMethod: PurchasesPaymentMethodRow[];
  byReceiptStatus: PurchasesReceiptStatusRow[];
  detail: PurchasesReportDetailRow[];
};

export async function getPurchasesReport(periodISO: string): Promise<PurchasesReportResult> {
  await connectDB();
  const from = periodStringToDate(periodISO);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);

  const purchases = await Purchase.find({ purchaseDate: { $gte: from, $lt: to } })
    .populate("provider")
    .sort({ purchaseDate: 1 })
    .lean();

  let totalAmount = 0;
  let paidCount = 0;
  let paidAmount = 0;
  let pendingCount = 0;
  let pendingAmount = 0;
  const methodMap = new Map<string, PurchasesPaymentMethodRow>();
  const receiptMap = new Map<PurchaseReceiptStatus, PurchasesReceiptStatusRow>();
  const detail: PurchasesReportDetailRow[] = [];

  for (const purchase of purchases) {
    // Mismo caso que en compras/page.tsx: si el proveedor fue borrado,
    // Mongoose deja `purchase.provider` en null (no el id crudo).
    const providerDoc =
      purchase.provider && typeof purchase.provider === "object" && "nombre" in purchase.provider
        ? (purchase.provider as unknown as { nombre: string })
        : null;
    const providerName = providerDoc?.nombre ?? "Proveedor eliminado";

    totalAmount += purchase.amount;
    if (purchase.paid) {
      paidCount += 1;
      paidAmount += purchase.amount;
    } else {
      pendingCount += 1;
      pendingAmount += purchase.amount;
    }

    const methodKey = purchase.paymentMethod || "Sin especificar";
    const methodRow = methodMap.get(methodKey) ?? { method: methodKey, count: 0, amount: 0 };
    methodRow.count += 1;
    methodRow.amount += purchase.amount;
    methodMap.set(methodKey, methodRow);

    const receiptRow = receiptMap.get(purchase.receiptStatus) ?? {
      status: purchase.receiptStatus,
      count: 0,
      amount: 0,
    };
    receiptRow.count += 1;
    receiptRow.amount += purchase.amount;
    receiptMap.set(purchase.receiptStatus, receiptRow);

    detail.push({
      id: purchase._id.toString(),
      providerName,
      purchaseDateISO: purchase.purchaseDate.toISOString().slice(0, 10),
      paymentMethod: purchase.paymentMethod,
      amount: purchase.amount,
      paid: purchase.paid,
      paidDateISO: purchase.paidDate ? purchase.paidDate.toISOString().slice(0, 10) : undefined,
      receiptStatus: purchase.receiptStatus,
      invoiceNumber: purchase.invoiceNumber,
    });
  }

  const byPaymentMethod = Array.from(methodMap.values()).sort((a, b) => b.amount - a.amount);
  const byReceiptStatus = Array.from(receiptMap.values()).sort((a, b) => b.amount - a.amount);

  return {
    periodISO,
    periodLabel: formatPeriod(from),
    totalCount: purchases.length,
    totalAmount,
    paidCount,
    paidAmount,
    pendingCount,
    pendingAmount,
    byPaymentMethod,
    byReceiptStatus,
    detail,
  };
}