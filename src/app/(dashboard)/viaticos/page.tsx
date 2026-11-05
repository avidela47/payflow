import { connectDB } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { Viatico } from "@/models/Viatico";
import { ViaticosClient, type ViaticoItem, type EmployeeOption } from "./viaticos-client";

function toISODate(date?: Date): string | undefined {
  return date ? date.toISOString().slice(0, 10) : undefined;
}

export default async function ViaticosPage() {
  await connectDB();

  const [employees, viaticos] = await Promise.all([
    Employee.find({ active: true }).sort({ nombre: 1 }).lean(),
    Viatico.find({})
      .populate(["empleados.employee", "topesDiarios.employee"])
      .sort({ fecha: -1 })
      .limit(500)
      .lean(),
  ]);

  const employeeOptions: EmployeeOption[] = employees.map((e) => ({
    id: e._id.toString(),
    nombre: e.nombre,
    apellido: e.apellido,
    area: e.area,
  }));

  const viaticoItems: ViaticoItem[] = viaticos.map((v) => ({
    id: v._id.toString(),
    nombre: v.nombre,
    paidBy: v.paidBy,
    fechaISO: v.fecha.toISOString().slice(0, 10),
    empleados: (v.empleados ?? []).map((e) => {
      // Si el empleado referenciado fue borrado, `populate` deja el campo
      // en null — mismo caso que Compras con el proveedor.
      const employeeDoc =
        e.employee && typeof e.employee === "object" && "_id" in e.employee
          ? (e.employee as unknown as { _id: { toString(): string }; nombre: string; apellido: string })
          : null;
      return {
        employeeId: employeeDoc ? employeeDoc._id.toString() : String(e.employee),
        employeeName: employeeDoc ? `${employeeDoc.nombre} ${employeeDoc.apellido}` : "Empleado eliminado",
        honorarioType: e.honorarioType,
        monto: e.monto,
        dias: e.dias,
        paymentMode: e.paymentMode,
      };
    }),
    hospedajeLugar: v.hospedaje?.lugar,
    hospedajeCheckIn: toISODate(v.hospedaje?.checkIn),
    hospedajeCheckOut: toISODate(v.hospedaje?.checkOut),
    hospedajeCostoPorDia: v.hospedaje?.costoPorDia,
    hospedajeCantidadDias: v.hospedaje?.cantidadDias,
    hospedajePaidBy: v.hospedaje?.paidBy,
    combustibleMonto: v.combustible?.monto,
    combustiblePaidBy: v.combustible?.paidBy,
    extras: (v.extras ?? []).map((x) => ({ descripcion: x.descripcion, monto: x.monto })),
    materiales: (v.materiales ?? []).map((m) => ({
      descripcion: m.descripcion,
      cantidad: m.cantidad,
      monto: m.monto,
      paymentMode: m.paymentMode,
    })),
    seguroCompania: v.seguro?.compania,
    seguroCobertura: v.seguro?.cobertura,
    seguroCantidadDias: v.seguro?.cantidadDias,
    seguroCosto: v.seguro?.costo,
    topesDiarios: (v.topesDiarios ?? []).map((t) => {
      const employeeDoc =
        t.employee && typeof t.employee === "object" && "_id" in t.employee
          ? (t.employee as unknown as { _id: { toString(): string }; nombre: string; apellido: string })
          : null;
      return {
        employeeId: employeeDoc ? employeeDoc._id.toString() : String(t.employee),
        employeeName: employeeDoc ? `${employeeDoc.nombre} ${employeeDoc.apellido}` : "Empleado eliminado",
        monto: t.monto,
      };
    }),
    excedente: v.excedente ?? 0,
    notes: v.notes,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Viajes</h1>
        <p className="text-sm text-muted-foreground">
          Gastos de viaje por obra: honorarios, hospedaje, combustible, extras, materiales y seguro.
        </p>
      </div>

      <ViaticosClient employees={employeeOptions} viaticos={viaticoItems} />
    </div>
  );
}