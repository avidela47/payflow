import { connectDB } from "@/lib/db";
import { Check } from "@/models/Check";
import { ChequesClient, type CheckItem } from "./cheques-client";

const DUE_SOON_DAYS = 7;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    date
  );
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function ChequesPage() {
  await connectDB();

  const checks = await Check.find({}).sort({ paymentDate: 1 }).limit(300).lean();

  const now = new Date();

  const checkItems: CheckItem[] = checks.map((check) => {
    const daysUntil = Math.ceil(
      (check.paymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Solo alertamos vencimientos de cheques que siguen activos — uno ya
    // cobrado/depositado/endosado no necesita aviso aunque su fecha de
    // pago haya quedado en el pasado.
    let dueAlert: CheckItem["dueAlert"];
    if (check.status === "ACTIVO") {
      if (daysUntil < 0) dueAlert = "vencido";
      else if (daysUntil <= DUE_SOON_DAYS) dueAlert = "proximo";
    }

    return {
      id: check._id.toString(),
      type: check.type,
      issueDateISO: toDateInputValue(check.issueDate),
      issueDateLabel: formatDate(check.issueDate),
      paymentDateISO: toDateInputValue(check.paymentDate),
      paymentDateLabel: formatDate(check.paymentDate),
      checkNumber: check.checkNumber,
      echeqId: check.echeqId,
      issuerName: check.issuerName,
      issuerCuit: check.issuerCuit,
      issuingBank: check.issuingBank,
      amount: check.amount,
      status: check.status,
      currentHolder: check.currentHolder,
      requestedBy: check.requestedBy,
      notes: check.notes,
      dueAlert,
      daysUntil,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cartera de Cheques</h1>
        <p className="text-sm text-muted-foreground">
          Cheques electrónicos y físicos recibidos, con estado y vencimientos.
        </p>
      </div>

      <ChequesClient checks={checkItems} />
    </div>
  );
}