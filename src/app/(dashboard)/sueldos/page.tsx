import { connectDB } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { PayrollEntry } from "@/models/PayrollEntry";
import { Card, CardContent } from "@/components/ui/card";
import { formatPeriod } from "@/lib/utils";
import { PayrollForm } from "./payroll-form";
import { PayrollEntriesTable, type PayrollGroupItem } from "./payroll-entries-table";

export default async function SueldosPage() {
  await connectDB();

  const [employees, entries] = await Promise.all([
    Employee.find({ active: true }).sort({ apellido: 1, nombre: 1 }).lean(),
    PayrollEntry.find({})
      .populate("employee")
      .sort({ period: -1 })
      .limit(100)
      .lean(),
  ]);

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
      <div>
        <h1 className="text-2xl font-semibold">Sueldos</h1>
        <p className="text-sm text-muted-foreground">
          Empleados asalariados, monotributistas y por hora.
        </p>
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