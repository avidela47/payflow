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
    <div className="flex">
            <Sidebar role={session.user.role} name={session.user.name ?? "Usuario"} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
