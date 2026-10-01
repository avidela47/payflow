import { connectDB } from "@/lib/db";
import { requireModuleAccess } from "@/lib/auth";
import { Employee } from "@/models/Employee";
import { PayrollEntry } from "@/models/PayrollEntry";
import { Card, CardContent } from "@/components/ui/card";
import { formatPeriod } from "@/lib/utils";
import { PayrollForm } from "./payroll-form";
import { PayrollEntriesTable, type PayrollGroupItem } from "./payroll-entries-table";
import { PayrollPeriodFilter } from "./payroll-period-filter";

function dateToPeriodParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Último recurso si todavía no hay NINGÚN pago cargado — ahí no hay de
// dónde sacar "el período más reciente", así que mostramos el mes
// anterior al actual (lo más probable que se vaya a cargar primero).
function previousMonthParam() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return dateToPeriodParam(prev);
}

export default async function SueldosPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requireModuleAccess("sueldos");
  await connectDB();

  const periodParam = searchParams?.period;
  const showAll = periodParam === "all";
  const validParam = periodParam && /^\d{4}-\d{2}$/.test(periodParam) ? periodParam : null;

  let selectedPeriod: string | null;
  if (showAll) {
    selectedPeriod = null;
  } else if (validParam) {
    selectedPeriod = validParam;
  } else {
    // Sin filtro explícito en la URL: mostramos por default el período
    // del pago más reciente cargado — NO "el mes actual", porque la
    // imputación siempre va un mes atrás del mes de pago, así que "mes
    // actual" casi nunca tiene nada cargado y parece que no se guardó.
    const latest = await PayrollEntry.findOne({}).sort({ period: -1 }).lean();
    selectedPeriod = latest ? dateToPeriodParam(latest.period) : previousMonthParam();
  }

  const employees = await Employee.find({ active: true }).sort({ apellido: 1, nombre: 1 }).lean();

  let entries;
  if (selectedPeriod) {
    const [year, month] = selectedPeriod.split("-").map(Number);
    const period = new Date(year, month - 1, 1);
    entries = await PayrollEntry.find({ period }).populate("employee").sort({ period: -1 }).lean();
  } else {
    entries = await PayrollEntry.find({})
      .populate("employee")
      .sort({ period: -1 })
      .limit(100)
      .lean();
  }

  // Agrupamos las liquidaciones registrado/informal de un mismo
  // empleado+período en una sola fila (con el total combinado). El
  // desglose se muestra al clickear el nombre, en la tabla.
  const groupsByKey = new Map<string, PayrollGroupItem>();

  for (const entry of entries) {
    // Ojo con esto: cuando el empleado referenciado fue borrado, Mongoose
    // NO deja el id crudo en `entry.employee` — lo deja en `null`. Antes
    // acá se asumía lo contrario (`entry.employee.toString()` en el else),
    // lo que tiraba abajo la página entera apenas alguien borraba un
    // empleado con sueldos cargados. Por eso ahora, si no hay doc
    // poblado, usamos el id de la propia liquidación (`entry._id`) como
    // clave — siempre existe, y separa cada liquidación huérfana en su
    // propia fila en vez de romper el render.
    const employeeDoc =
      entry.employee && typeof entry.employee === "object" && "nombre" in entry.employee
        ? (entry.employee as unknown as { _id: { toString(): string }; nombre: string; apellido: string })
        : null;

    const employeeId = employeeDoc
      ? employeeDoc._id.toString()
      : `huerfano-${entry._id.toString()}`;
    const periodISO = entry.period.toISOString();
    const key = `${employeeId}-${periodISO}`;

    const existing = groupsByKey.get(key);
    const group: PayrollGroupItem =
      existing ??
      {
        employeeId,
        periodISO,
        employeeName: employeeDoc
          ? `${employeeDoc.nombre} ${employeeDoc.apellido}`
          : "Empleado eliminado",
        periodLabel: formatPeriod(entry.period),
        registradoAmount: 0,
        informalAmount: 0,
        total: 0,
        paidBy: undefined,
        notes: undefined,
        paid: true, // se recalcula abajo: sólo queda true si TODAS las partes están pagas
      };

    if (entry.modality === "REGISTRADO") {
      group.registradoAmount = entry.amount;
    } else {
      group.informalAmount = entry.amount;
    }
    group.total = group.registradoAmount + group.informalAmount;
    group.paidBy = group.paidBy ?? entry.paidBy;
    group.notes = group.notes ?? entry.notes;
    group.paid = group.paid && entry.paid;

    groupsByKey.set(key, group);
  }

  const groups = Array.from(groupsByKey.values()).sort(
    (a, b) => new Date(b.periodISO).getTime() - new Date(a.periodISO).getTime()
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sueldos</h1>
          <p className="text-sm text-muted-foreground">
            Empleados asalariados, monotributistas y por hora.
          </p>
        </div>
        <PayrollPeriodFilter selectedPeriod={selectedPeriod} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <PayrollForm
            employees={employees.map((e) => ({
              id: e._id.toString(),
              name: `${e.nombre} ${e.apellido}`,
              category: e.category,
              paymentType: e.paymentType,
              hourlyRate: e.hourlyRate,
            }))}
          />
        </CardContent>
      </Card>

      <PayrollEntriesTable groups={groups} />
    </div>
  );
}