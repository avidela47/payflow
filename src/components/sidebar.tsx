"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Building2,
  Wallet,
  Receipt,
  Landmark,
  CalendarClock,
  CalendarDays,
  FileBarChart,
  KeyRound,
  StickyNote,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Truck,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/empleados", label: "Empleados", icon: Users, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/clientes", label: "Clientes", icon: Building2, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/proveedores", label: "Proveedores", icon: Truck, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/ventas", label: "Ventas", icon: TrendingUp, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/compras", label: "Compras", icon: ShoppingCart, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/sueldos", label: "Sueldos", icon: Wallet, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/costos-fijos", label: "Costos Fijos", icon: Receipt, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/cheques", label: "Cheques", icon: Landmark, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/agenda", label: "Agenda", icon: CalendarClock, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/calendario", label: "Calendario", icon: CalendarDays, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/reportes", label: "Reportes", icon: FileBarChart, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/vault", label: "Vault", icon: KeyRound, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/notas", label: "Notas", icon: StickyNote, roles: ["OWNER", "ACCOUNTANT"] },
];

export function Sidebar({ role, name }: { role: string; name: string }) {
  const pathname = usePathname();
  // Solo importa en mobile/tablet (< md) — en desktop el aside queda
  // siempre visible y este estado no se usa para nada.
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Barra superior: solo se ve en mobile/tablet (md:hidden). En
          desktop el logo/nombre van dentro del aside de siempre. */}
      <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="PayFlow" className="h-7 w-auto" />
          <span className="font-semibold">{name}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Fondo oscuro detrás del menú, solo mientras está abierto en
          mobile/tablet. Tocarlo cierra el menú. */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background transition-transform duration-200",
          "md:static md:z-auto md:h-screen md:w-56 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header del menú en desktop (siempre visible) */}
        <div className="hidden items-center gap-2 border-b border-border px-4 py-4 md:flex">
          <img src="/logo.png" alt="PayFlow" className="h-8 w-auto" />
          <span className="font-semibold">{name}</span>
        </div>
        {/* Header del menú en mobile/tablet (dentro del panel deslizante,
            con botón para cerrarlo) */}
        <div className="flex items-center justify-between border-b border-border px-4 py-4 md:hidden">
          <span className="font-semibold">{name}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems
            .filter((item) => item.roles.includes(role))
            .map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
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
    </>
  );
}