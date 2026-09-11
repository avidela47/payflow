"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Receipt,
  Landmark,
  CalendarClock,
  FileBarChart,
  KeyRound,
  StickyNote,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/empleados", label: "Empleados", icon: Users, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/sueldos", label: "Sueldos", icon: Wallet, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/costos-fijos", label: "Costos Fijos", icon: Receipt, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/cheques", label: "Cheques", icon: Landmark, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/agenda", label: "Agenda", icon: CalendarClock, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/reportes", label: "Reportes", icon: FileBarChart, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/vault", label: "Vault", icon: KeyRound, roles: ["OWNER"] },
  { href: "/notas", label: "Notas", icon: StickyNote, roles: ["OWNER", "ACCOUNTANT"] },
];

export function Sidebar({ role, name }: { role: string; name: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <img src="/logo.png" alt="PayFlow" className="h-8 w-auto" />
        <span className="font-semibold">{name}</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems
          .filter((item) => item.roles.includes(role))
          .map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}