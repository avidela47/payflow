import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Check } from "@/models/Check";
import {
  isTipoSlug,
  isVistaSlug,
  TIPO_LABELS,
  VISTA_LABELS,
  TIPO_TO_TYPE,
  VISTA_TO_DIRECTION,
  checkFilterFor,
  type TipoSlug,
  type VistaSlug,
} from "../../shared";
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

export default async function ChequesVistaPage({
  params,
}: {
  params: { tipo: string; vista: string };
}) {
  await requireModuleAccess("cheques");

  if (!isTipoSlug(params.tipo) || !isVistaSlug(params.vista)) {
    notFound();
  }
  const tipo = params.tipo as TipoSlug;
  const vista = params.vista as VistaSlug;

  await connectDB();

  const checks = await Check.find(checkFilterFor(tipo, vista))
    .sort({ paymentDate: 1 })
    .limit(300)
    .lean();

  const now = new Date();

  // Solo alertamos vencimientos de cheques que siguen activos — uno ya
  // cobrado/depositado/endosado no necesita aviso aunque su fecha de
  // pago haya quedado en el pasado.
  const checkItems: CheckItem[] = checks.map((check) => {
    const daysUntil = Math.ceil(
      (check.paymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let dueAlert: CheckItem["dueAlert"];
    if (check.status === "ACTIVO") {
      if (daysUntil < 0) dueAlert = "vencido";
      else if (daysUntil <= DUE_SOON_DAYS) dueAlert = "proximo";
    }

    return {
      id: check._id.toString(),
      type: check.type,
      direction: check.direction,
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
        <Link
          href={`/cheques/${tipo}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Cheques {TIPO_LABELS[tipo]}
        </Link>
        <h1 className="text-2xl font-semibold">
          {TIPO_LABELS[tipo]} — {VISTA_LABELS[vista]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {vista === "endosados"
            ? "Cheques recibidos que se endosaron a un tercero en vez de depositarse."
            : vista === "emitidos"
              ? "Cheques que ITELSA le entregó a otro para pagarle."
              : "Cheques recibidos de un cliente, pendientes de cobrar o endosar."}
        </p>
      </div>

      <ChequesClient
        checks={checkItems}
        lockedType={TIPO_TO_TYPE[tipo]}
        lockedDirection={VISTA_TO_DIRECTION[vista]}
        allowCreate={vista !== "endosados"}
      />
    </div>
  );
}