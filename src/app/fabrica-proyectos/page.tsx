import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { Componente } from "@/models/Componente";
import { listarProyectosActivos } from "@/app/(dashboard)/proyectos/actions";
import { listarReparacionesActivas } from "@/app/(dashboard)/reparaciones/actions";
import { FabricaProyectosClient, type OperarioOption, type ComponenteOption } from "./fabrica-proyectos-client";

// Pantalla kiosco del taller — fuera de (dashboard) a propósito, sin
// sidebar (igual que el original: app/fabrica-proyectos/page.tsx no tenía
// menú). No hace falta loguearse por operario para tomar/avanzar/marcar
// listo un proyecto ni una reparación, pero el dispositivo que muestra
// esta pantalla sí tiene que estar con una sesión que tenga acceso a
// "proyectos" o a "reparaciones" (ampliado el 2026-11-23: Ariel pidió que
// el taller vea también las Reparaciones pendientes acá, con la misma
// alerta y un proceso de tomar/marcar lista calcado de Proyecto — ver
// reparacion-estados.ts). Solo redirige si está restringido de AMBOS
// módulos; si tiene acceso a uno solo, ve esa mitad de la pantalla.
export default async function FabricaProyectosPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  const sinProyectos = session.user.restrictedModules?.includes("proyectos") ?? false;
  const sinReparaciones = session.user.restrictedModules?.includes("reparaciones") ?? false;
  if (sinProyectos && sinReparaciones) {
    redirect("/");
  }

  await connectDB();
  const [proyectos, reparaciones, empleados, componentes] = await Promise.all([
    sinProyectos ? Promise.resolve([]) : listarProyectosActivos(),
    sinReparaciones ? Promise.resolve([]) : listarReparacionesActivas(),
    Employee.find({ active: true }).sort({ nombre: 1 }).lean(),
    Componente.find({}).sort({ codigo: 1 }).lean(),
  ]);

  const operarios: OperarioOption[] = empleados.map((e) => ({
    id: e._id.toString(),
    nombre: `${e.nombre} ${e.apellido}`.trim(),
  }));

  const componenteOptions: ComponenteOption[] = componentes.map((c) => ({
    id: c._id.toString(),
    codigo: c.codigo,
    descripcion: c.descripcion,
    stockActual: c.stockActual,
  }));

  return (
    <FabricaProyectosClient
      initialProyectos={proyectos}
      initialReparaciones={reparaciones}
      operarios={operarios}
      componentes={componenteOptions}
      mostrarProyectos={!sinProyectos}
      mostrarReparaciones={!sinReparaciones}
      esAdmin={session.user.role === "OWNER"}
    />
  );
}
