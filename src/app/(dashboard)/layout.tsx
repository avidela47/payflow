import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Employee } from "@/models/Employee";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  // Mismo criterio que el avatar del header del Dashboard (ver page.tsx):
  // si la cuenta está ligada a un legajo de Empleados (User.employeeId),
  // mostramos la foto real ahí; si no, el círculo de iniciales de siempre.
  // Esto se pide acá (en el layout) y no en page.tsx porque el Sidebar se
  // ve en TODAS las páginas, no solo en el Dashboard.
  await connectDB();
  const linkedEmployee = session.user.employeeId
    ? await Employee.findById(session.user.employeeId, "foto").lean()
    : null;

  return (
    <div className="flex flex-col md:h-screen md:flex-row">
      <Sidebar
        role={session.user.role}
        name={session.user.name ?? "Usuario"}
        foto={linkedEmployee?.foto}
        restrictedModules={session.user.restrictedModules ?? []}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}