import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
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

  // 2026-11-26, Ariel: sacar nombre/foto de la barra lateral — quedaba
  // "horrible" ahí. El saludo con nombre y el avatar con foto real (ver
  // Employee.foto vía User.employeeId) siguen solo en el header del
  // Dashboard (page.tsx), que es donde estaban antes de este agregado.
  return (
    <div className="flex flex-col md:h-screen md:flex-row">
      <Sidebar
        role={session.user.role}
        restrictedModules={session.user.restrictedModules ?? []}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
