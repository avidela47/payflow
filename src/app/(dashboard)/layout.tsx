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

  return (
    <div className="flex flex-col md:h-screen md:flex-row">
      <Sidebar
        role={session.user.role}
        name={session.user.name ?? "Usuario"}
        restrictedModules={session.user.restrictedModules ?? []}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}