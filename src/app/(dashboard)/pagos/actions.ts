"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Payment } from "@/models/Payment";
import { Purchase } from "@/models/Purchase";
import { Provider } from "@/models/Provider";
import { Check } from "@/models/Check";
import { RetentionRegime } from "@/models/RetentionRegime";
import { GANANCIAS_CONDITIONS, type GananciasCondition } from "@/lib/ganancias-conditions";

// ---------- contexto al elegir proveedor (compras pendientes + condición) ----------

export async function getProviderPendingPurchases(providerId: string) {
  const session = await getSession();
  if (!session?.user) return { ok: false as const, error: "No autenticado." };

  if (!providerId) return { ok: false as const, error: "Falta el proveedor." };

  try {
    await connectDB();
    const [provider, purchases] = await Promise.all([
      Provider.findById(providerId, "nombre cuit condicionGanancias").lean(),
      Purchase.find({ provider: providerId, paid: false }).sort({ purchaseDate: 1 }).lean(),
    ]);
    if (!provider) return { ok: false as const, error: "Ese proveedor ya no existe." };

    return {
      ok: true as const,
      condicionGanancias: provider.condicionGanancias ?? null,
      purchases: purchases.map((p) => ({
        id: p._id.toString(),
        invoiceNumber: p.invoiceNumber ?? "",
        purchaseDate: p.purchaseDate.toISOString(),
        amount: p.amount,
      })),
    };
  } catch (err) {
    console.error("getProviderPendingPurchases error:", err);
    return { ok: false as const, error: "No se pudieron traer las compras pendientes." };
  }
}

// ---------- sugerencia de retención (RG 830) ----------

// Primer y último instante del mes calendario de `date`, en UTC — alcanza
// para "acumulado del mes" porque lo único que importa es agrupar pagos
// del mismo mes, no la hora exacta.
function monthRange(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function calculateSuggestedRetention(input: {
  providerId: string;
  regimeCode: string;
  grossAmount: number;
  condicionGanancias: GananciasCondition | null;
  paymentDate: string; // "YYYY-MM-DD"
  excludePaymentId?: string; // al editar un pago existente, no sumarse a sí mismo
}) {
  const session = await getSession();
  if (!session?.user) return { ok: false as const, error: "No autenticado." };

  try {
    await connectDB();
    const regime = await RetentionRegime.findOne({ codigo: input.regimeCode }).lean();
    if (!regime) return { ok: false as const, error: "Ese régimen ya no existe." };

    const refDate = new Date(`${input.paymentDate}T00:00:00Z`);
    const { start, end } = monthRange(refDate);

    const priorFilter: Record<string, unknown> = {
      provider: input.providerId,
      regimeCode: input.regimeCode,
      paymentDate: { $gte: start, $lt: end },
    };
    if (input.excludePaymentId) priorFilter._id = { $ne: input.excludePaymentId };

    const priorPayments = await Payment.find(priorFilter, "grossAmount retentionGanancias").lean();
    const priorMonthGross = priorPayments.reduce((sum, p) => sum + p.grossAmount, 0);
    const priorMonthWithheld = priorPayments.reduce(
      (sum, p) => sum + (p.retentionGanancias?.withheldAmount ?? 0),
      0
    );

    const isInscripto = input.condicionGanancias === "INSCRIPTO";
    const nonTaxableAmountUsed = isInscripto ? regime.montoNoImponible : 0;
    const rateUsed = isInscripto ? regime.alicuotaInscripto : regime.alicuotaNoInscripto;

    const newAccumulatedGross = priorMonthGross + input.grossAmount;
    const taxableAccumulated = Math.max(0, newAccumulatedGross - nonTaxableAmountUsed);
    const totalRetentionDue = taxableAccumulated * (rateUsed / 100);
    const withheldAmount = Math.max(0, Math.round((totalRetentionDue - priorMonthWithheld) * 100) / 100);

    return {
      ok: true as const,
      nonTaxableAmountUsed,
      rateUsed,
      priorMonthGross,
      priorMonthWithheld,
      withheldAmount,
    };
  } catch (err) {
    console.error("calculateSuggestedRetention error:", err);
    return { ok: false as const, error: "No se pudo calcular la retención sugerida." };
  }
}

// ---------- crear pago ----------

const paymentSchema = z.object({
  providerId: z.string().min(1, "Elegí un proveedor."),
  paymentDate: z.string().min(1, "Falta la fecha de pago."),
  purchaseIds: z.array(z.string()).min(1, "Elegí al menos una compra a saldar."),
  grossAmount: z.coerce.number().positive("El monto bruto tiene que ser mayor a cero."),
  regimeCode: z.string().min(1, "Elegí un régimen."),
  condicionGanancias: z.enum(GANANCIAS_CONDITIONS).optional().or(z.literal("")),
  nonTaxableAmountUsed: z.coerce.number().min(0).default(0),
  rateUsed: z.coerce.number().min(0).default(0),
  priorMonthGross: z.coerce.number().min(0).default(0),
  priorMonthWithheld: z.coerce.number().min(0).default(0),
  withheldAmount: z.coerce.number().min(0).default(0),
  retentionIIBB: z.coerce.number().min(0).default(0),
  retentionOther: z.coerce.number().min(0).default(0),
  voucherNumber: z.string().optional(),
  paymentOrderNumber: z.string().optional(),
  notes: z.string().optional(),
  checkType: z.array(z.enum(["FISICO", "ELECTRONICO"])).default([]),
  checkBank: z.array(z.string()).default([]),
  checkNumber: z.array(z.string()).default([]),
  checkPaymentDate: z.array(z.string()).default([]),
  checkAmount: z.array(z.string()).default([]),
});

function parsePaymentForm(formData: FormData) {
  return paymentSchema.safeParse({
    providerId: formData.get("providerId"),
    paymentDate: formData.get("paymentDate"),
    purchaseIds: formData.getAll("purchaseIds"),
    grossAmount: formData.get("grossAmount"),
    regimeCode: formData.get("regimeCode"),
    condicionGanancias: formData.get("condicionGanancias") || undefined,
    nonTaxableAmountUsed: formData.get("nonTaxableAmountUsed") || 0,
    rateUsed: formData.get("rateUsed") || 0,
    priorMonthGross: formData.get("priorMonthGross") || 0,
    priorMonthWithheld: formData.get("priorMonthWithheld") || 0,
    withheldAmount: formData.get("withheldAmount") || 0,
    retentionIIBB: formData.get("retentionIIBB") || 0,
    retentionOther: formData.get("retentionOther") || 0,
    voucherNumber: formData.get("voucherNumber") || undefined,
    paymentOrderNumber: formData.get("paymentOrderNumber") || undefined,
    notes: formData.get("notes") || undefined,
    checkType: formData.getAll("checkType"),
    checkBank: formData.getAll("checkBank"),
    checkNumber: formData.getAll("checkNumber"),
    checkPaymentDate: formData.getAll("checkPaymentDate"),
    checkAmount: formData.getAll("checkAmount"),
  });
}

export async function createPayment(formData: FormData) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  const parsed = parsePaymentForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  // Las filas de cheques llegan como columnas paralelas (checkBank[i],
  // checkNumber[i], ...) — si alguna vino desalineada (el usuario borró una
  // fila a mitad de carga, por ej.) mejor fallar acá con un mensaje claro
  // que guardar un cheque con datos cruzados.
  const checksCount = data.checkNumber.length;
  if (
    data.checkType.length !== checksCount ||
    data.checkBank.length !== checksCount ||
    data.checkPaymentDate.length !== checksCount ||
    data.checkAmount.length !== checksCount
  ) {
    return { ok: false, error: "Los datos de los cheques quedaron desalineados. Recargá el formulario." };
  }
  if (checksCount === 0) {
    return { ok: false, error: "Agregá al menos un cheque para cubrir el pago." };
  }

  try {
    await connectDB();

    const provider = await Provider.findById(data.providerId, "nombre cuit").lean();
    if (!provider) {
      return { ok: false, error: "Ese proveedor ya no existe." };
    }

    // Revalidamos server-side que las compras elegidas sean realmente de
    // este proveedor y sigan pendientes — nunca confiamos en lo que venía
    // tildado en el formulario del cliente para decidir qué se marca como
    // pagado.
    const purchases = await Purchase.find({
      _id: { $in: data.purchaseIds },
      provider: data.providerId,
      paid: false,
    }).lean();
    if (purchases.length !== data.purchaseIds.length) {
      return {
        ok: false,
        error: "Alguna de las compras elegidas ya no está pendiente de pago. Recargá el formulario.",
      };
    }

    const paymentDate = new Date(`${data.paymentDate}T00:00:00Z`);

    const checkDocs = await Check.insertMany(
      data.checkNumber.map((checkNumber, i) => ({
        type: data.checkType[i],
        direction: "EMITIDO" as const,
        issueDate: paymentDate,
        paymentDate: new Date(`${data.checkPaymentDate[i]}T00:00:00Z`),
        checkNumber,
        issuerName: provider.nombre,
        issuerCuit: provider.cuit,
        issuingBank: data.checkBank[i] || undefined,
        amount: Number(data.checkAmount[i]),
        status: "ACTIVO" as const,
        requestedBy: session.user.name,
      }))
    );

    await Payment.create({
      provider: data.providerId,
      paymentDate,
      purchases: purchases.map((p) => ({ purchase: p._id, amount: p.amount })),
      grossAmount: data.grossAmount,
      regimeCode: data.regimeCode,
      condicionGanancias: data.condicionGanancias || undefined,
      retentionGanancias: {
        nonTaxableAmountUsed: data.nonTaxableAmountUsed,
        rateUsed: data.rateUsed,
        priorMonthGross: data.priorMonthGross,
        priorMonthWithheld: data.priorMonthWithheld,
        withheldAmount: data.withheldAmount,
      },
      retentionIIBB: data.retentionIIBB,
      retentionOther: data.retentionOther,
      voucherNumber: data.voucherNumber,
      paymentOrderNumber: data.paymentOrderNumber,
      checks: checkDocs.map((c) => ({ check: c._id })),
      notes: data.notes,
    });

    await Purchase.updateMany(
      { _id: { $in: data.purchaseIds } },
      { $set: { paid: true, paidDate: paymentDate } }
    );
  } catch (err) {
    console.error("createPayment error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear el pago: ${message}` };
  }

  revalidatePath("/pagos");
  revalidatePath("/compras");
  revalidatePath("/cheques");
  return { ok: true };
}

export async function deletePayment(paymentId: string) {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, error: "No autenticado." };
  }

  try {
    await connectDB();
    const payment = await Payment.findById(paymentId).lean();
    if (!payment) {
      return { ok: false, error: "Ese pago ya no existe." };
    }

    // Deshace lo que generó: vuelve a dejar esas compras como pendientes y
    // borra los cheques que había creado — así "borrar pago" no deja
    // compras marcadas como pagadas sin ningún pago real detrás.
    await Purchase.updateMany(
      { _id: { $in: payment.purchases.map((p) => p.purchase) } },
      { $set: { paid: false }, $unset: { paidDate: "" } }
    );
    await Check.deleteMany({ _id: { $in: payment.checks.map((c) => c.check) } });
    await Payment.findByIdAndDelete(paymentId);
  } catch (err) {
    console.error("deletePayment error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el pago: ${message}` };
  }

  revalidatePath("/pagos");
  revalidatePath("/compras");
  revalidatePath("/cheques");
  return { ok: true };
}

// ---------- catálogo de regímenes (editable desde la app) ----------

const regimeSchema = z.object({
  codigo: z.string().min(1, "Falta el código."),
  concepto: z.string().min(1, "Falta el concepto."),
  alicuotaInscripto: z.coerce.number().min(0, "La alícuota no puede ser negativa."),
  alicuotaNoInscripto: z.coerce.number().min(0, "La alícuota no puede ser negativa."),
  montoNoImponible: z.coerce.number().min(0).default(0),
});

function parseRegimeForm(formData: FormData) {
  return regimeSchema.safeParse({
    codigo: formData.get("codigo"),
    concepto: formData.get("concepto"),
    alicuotaInscripto: formData.get("alicuotaInscripto"),
    alicuotaNoInscripto: formData.get("alicuotaNoInscripto"),
    montoNoImponible: formData.get("montoNoImponible") || 0,
  });
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;
}

export async function createRetentionRegime(formData: FormData) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  const parsed = parseRegimeForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await RetentionRegime.create(parsed.data);
  } catch (err) {
    console.error("createRetentionRegime error:", err);
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "Ya existe un régimen con ese código." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo crear el régimen: ${message}` };
  }

  revalidatePath("/pagos");
  return { ok: true };
}

export async function updateRetentionRegime(regimeId: string, formData: FormData) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  const parsed = parseRegimeForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await connectDB();
    await RetentionRegime.findByIdAndUpdate(regimeId, parsed.data);
  } catch (err) {
    console.error("updateRetentionRegime error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo actualizar el régimen: ${message}` };
  }

  revalidatePath("/pagos");
  return { ok: true };
}

export async function deleteRetentionRegime(regimeId: string) {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "No autenticado." };

  try {
    await connectDB();
    await RetentionRegime.findByIdAndDelete(regimeId);
  } catch (err) {
    console.error("deleteRetentionRegime error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `No se pudo borrar el régimen: ${message}` };
  }

  revalidatePath("/pagos");
  return { ok: true };
}