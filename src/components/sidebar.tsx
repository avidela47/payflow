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
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";

// moduleKey ausente = módulo que no se puede restringir por usuario (solo
// por rol) — Dashboard, Clientes, Proveedores, Ventas, Compras, Agenda,
// Calendario y Notas quedan siempre visibles para OWNER/ACCOUNTANT.
//
// `chip` es el mismo lenguaje visual que ya tienen /reportes y el
// Dashboard: un ícono en un chip con degradé de color, uno distinto por
// módulo. Los colores coinciden con los que ya usa la grilla "Todos los
// módulos" del Dashboard (Empleados azul, Sueldos verde, Cheques rosa,
// etc.) para que el mismo módulo se reconozca por color en toda la app.
// Dashboard y Caja Chica no están en esa grilla, así que les tocó un
// color propio (celeste y lima) que no pisa a ningún otro.
const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["OWNER", "ACCOUNTANT"],
    chip: "bg-gradient-to-br from-sky-500 to-sky-600 shadow-sm shadow-sky-500/20",
  },
  {
    href: "/empleados",
    label: "Empleados",
    icon: Users,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "empleados",
    chip: "bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm shadow-blue-500/20",
  },
  {
    href: "/clientes",
    label: "Clientes",
    icon: Building2,
    roles: ["OWNER", "ACCOUNTANT"],
    chip: "bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-sm shadow-indigo-500/20",
  },
  {
    href: "/proveedores",
    label: "Proveedores",
    icon: Truck,
    roles: ["OWNER", "ACCOUNTANT"],
    chip: "bg-gradient-to-br from-purple-500 to-purple-600 shadow-sm shadow-purple-500/20",
  },
  {
    href: "/ventas",
    label: "Ventas",
    icon: TrendingUp,
    roles: ["OWNER", "ACCOUNTANT"],
    chip: "bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/20",
  },
  {
    href: "/compras",
    label: "Compras",
    icon: ShoppingCart,
    roles: ["OWNER", "ACCOUNTANT"],
    chip: "bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm shadow-orange-500/20",
  },
  {
    href: "/sueldos",
    label: "Sueldos",
    icon: Wallet,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "sueldos",
    chip: "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm shadow-emerald-500/20",
  },
  {
    href: "/costos-fijos",
    label: "Costos Fijos",
    icon: Receipt,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "costos-fijos",
    chip: "bg-gradient-to-br from-amber-500 to-amber-600 shadow-sm shadow-amber-500/20",
  },
  {
    href: "/cheques",
    label: "Cheques",
    icon: Landmark,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "cheques",
    chip: "bg-gradient-to-br from-rose-500 to-rose-600 shadow-sm shadow-rose-500/20",
  },
  {
    href: "/caja-chica",
    label: "Caja Chica",
    icon: Banknote,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "caja-chica",
    chip: "bg-gradient-to-br from-lime-500 to-lime-600 shadow-sm shadow-lime-500/20",
  },
  {
    href: "/agenda",
    label: "Agenda",
    icon: CalendarClock,
    roles: ["OWNER", "ACCOUNTANT"],
    chip: "bg-gradient-to-br from-violet-500 to-violet-600 shadow-sm shadow-violet-500/20",
  },
  {
    href: "/calendario",
    label: "Calendario",
    icon: CalendarDays,
    roles: ["OWNER", "ACCOUNTANT"],
    chip: "bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-sm shadow-cyan-500/20",
  },
  {
    href: "/reportes",
    label: "Reportes",
    icon: FileBarChart,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "reportes",
    chip: "bg-gradient-to-br from-slate-500 to-slate-600 shadow-sm shadow-slate-500/20",
  },
  {
    href: "/vault",
    label: "Vault",
    icon: KeyRound,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "vault",
    chip: "bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 shadow-sm shadow-fuchsia-500/20",
  },
  {
    href: "/notas",
    label: "Notas",
    icon: StickyNote,
    roles: ["OWNER", "ACCOUNTANT"],
    chip: "bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-sm shadow-yellow-500/20",
  },
];

export function Sidebar({
  role,
  name,
  restrictedModules,
}: {
  role: string;
  name: string;
  restrictedModules: string[];
}) {
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
            .filter((item) => !item.moduleKey || !restrictedModules.includes(item.moduleKey))
            .map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md py-1.5 pl-1.5 pr-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-muted font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      item.chip
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  {item.label}
                </Link>
              );
            })}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2.5 rounded-md py-1.5 pl-1.5 pr-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-destructive/10">
              <LogOut className="h-3.5 w-3.5 text-destructive" />
            </div>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}