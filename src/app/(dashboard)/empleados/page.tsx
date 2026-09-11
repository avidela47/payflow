import { connectDB } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { EmployeesClient } from "./employees-client";

function toDateInputValue(date?: Date) {
  if (!date) return undefined;
  return new Date(date).toISOString().slice(0, 10);
}

export default async function EmpleadosPage() {
  await connectDB();

  const employees = await Employee.find({})
    .sort({ active: -1, apellido: 1, nombre: 1 })
    .lean();

  const items = employees.map((emp) => ({
    id: emp._id.toString(),
    nombre: emp.nombre,
    apellido: emp.apellido,
    dni: emp.dni,
    direccion: emp.direccion,
    telefono: emp.telefono,
    email: emp.email,
    fechaIngreso: toDateInputValue(emp.fechaIngreso),
    notas: emp.notas,
    category: emp.category,
    monotributoCategoria: emp.monotributoCategoria,
    paymentType: emp.paymentType,
    cuit: emp.cuit,
    hourlyRate: emp.hourlyRate,
    banco: emp.banco,
    cbuAlias: emp.cbuAlias,
    active: emp.active,
  }));

  return <EmployeesClient employees={items} />;
}