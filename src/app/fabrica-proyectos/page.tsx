import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { listarProyectosActivos } from "@/app/(dashboard)/proyectos/actions";
import { FabricaProyectosClient, type OperarioOption } from "./fabrica-proyectos-client";

// Pantalla kiosco del taller — fuera de (dashboard) a propósito, sin
// sidebar (igual que el original: app/fabrica-proyectos/page.tsx no tenía
// menú). No hace falta loguearse por operario para tomar/avanzar/marcar
// listo un proyecto (ver proyectos/actions.ts), pero el dispositivo que
// muestra esta pantalla sí tiene que estar con una sesión que tenga
// acceso al módulo "proyectos".
export default async function FabricaProyectosPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.restrictedModules?.includes("proyectos")) {
    redirect("/");
  }

  await connectDB();
  const [proyectos, empleados] = await Promise.all([
    listarProyectosActivos(),
    Employee.find({ active: true }).sort({ nombre: 1 }).lean(),
  ]);

  const operarios: OperarioOption[] = empleados.map((e) => ({
    id: e._id.toString(),
    nombre: `${e.nombre} ${e.apellido}`.trim(),
  }));

  return (
    <FabricaProyectosClient
      initialProyectos={proyectos}
      operarios={operarios}
      esAdmin={session.user.role === "OWNER"}
    />
  );
}
