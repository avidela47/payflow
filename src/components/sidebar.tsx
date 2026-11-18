"use client";

import { useEffect, useState } from "react";
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
  Plane,
  CreditCard,
  Zap,
  Lightbulb,
  Wrench,
  Package,
  FileText,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Send,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// moduleKey ausente = módulo que no se puede restringir por usuario (solo
// por rol) — Dashboard, Clientes, Proveedores, Ventas, Compras, Agenda,
// Calendario y Notas quedan siempre visibles para OWNER/ACCOUNTANT.
//
// Rediseño (vuelta a neutro, igual que el Dashboard): un solo acento
// (primary) para todos los íconos, fila activa con fondo gris neutro en
// vez de color por módulo. Única excepción a propósito: Notas mantiene su
// ícono amarillo porque ahí el color es parte de la metáfora visual
// ("post-it"), no decoración de módulo — Ariel pidió explícitamente no
// tocar esa.
//
// "section" (opcional): agrupa visualmente con un encabezado en el sidebar
// — ver fusión con Gestión de Luminarias (planificacion/fusion-gestion-
// luminarias.md). Sin section = los módulos administrativos de siempre,
// sin encabezado.
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
  moduleKey?: string;
  special?: string;
  section?: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["OWNER", "ACCOUNTANT"] },
  {
    href: "/empleados",
    label: "Empleados",
    icon: Users,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "empleados",
  },
  { href: "/clientes", label: "Clientes", icon: Building2, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/proveedores", label: "Proveedores", icon: Truck, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/ventas", label: "Ventas", icon: TrendingUp, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/compras", label: "Compras", icon: ShoppingCart, roles: ["OWNER", "ACCOUNTANT"] },
  {
    href: "/pagos",
    label: "Pagos",
    icon: CreditCard,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "pagos",
  },
  {
    href: "/sueldos",
    label: "Sueldos",
    icon: Wallet,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "sueldos",
  },
  {
    href: "/costos-fijos",
    label: "Costos Fijos",
    icon: Receipt,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "costos-fijos",
  },
  {
    href: "/cheques",
    label: "Cheques",
    icon: Landmark,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "cheques",
  },
  {
    href: "/caja-chica",
    label: "Caja Chica",
    icon: Banknote,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "caja-chica",
  },
  {
    href: "/viaticos",
    label: "Viajes",
    icon: Plane,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "viaticos",
  },
  { href: "/agenda", label: "Agenda", icon: CalendarClock, roles: ["OWNER", "ACCOUNTANT"] },
  { href: "/calendario", label: "Calendario", icon: CalendarDays, roles: ["OWNER", "ACCOUNTANT"] },
  {
    href: "/reportes",
    label: "Reportes",
    icon: FileBarChart,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "reportes",
  },
  {
    href: "/vault",
    label: "Vault",
    icon: KeyRound,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "vault",
  },
  {
    href: "/notas",
    label: "Notas",
    icon: StickyNote,
    roles: ["OWNER", "ACCOUNTANT"],
    // Única excepción al acento único: post-it amarillo a propósito.
    special: "bg-yellow-100 text-yellow-700",
  },
  // Primer módulo de la fusión con "Gestión de Luminarias" (ver
  // planificacion/fusion-gestion-luminarias.md en el proyecto). Es el
  // arranque de una sección nueva de planta — por eso lleva "section":
  // separa visualmente del resto con un encabezado, siguiendo el estilo
  // agrupado por secciones que tenía esa app y que a Ariel le gustó. Más
  // módulos de planta (Luminarias, Herramientas, Materiales, etc.) van a
  // sumarse a esta misma sección más adelante.
  {
    href: "/sensores",
    label: "Sensores y Fuentes",
    icon: Zap,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "sensores",
    section: "STOCK",
  },
  {
    href: "/luminarias",
    label: "Luminarias",
    icon: Lightbulb,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "luminarias",
    section: "STOCK",
  },
  {
    href: "/herramientas",
    label: "Herramientas",
    icon: Wrench,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "herramientas",
    section: "STOCK",
  },
  {
    href: "/materiales",
    label: "Materiales de Obra",
    icon: Package,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "materiales",
    section: "STOCK",
  },
  // Fase 4 de la fusión con Gestión de Luminarias: documentos de venta de
  // planta (Presupuesto → Orden de Trabajo → Remito → Despacho → Recibo).
  // Sección nueva porque es un circuito propio de planta, separado de
  // Ventas/Compras (que siguen siendo el registro contable de siempre
  // para la contadora, sin tocar). Más módulos de este bloque se suman acá
  // a medida que se construyen.
  {
    href: "/presupuestos",
    label: "Presupuestos",
    icon: FileText,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "presupuestos",
    section: "COMERCIAL PLANTA",
  },
  {
    href: "/remitos",
    label: "Remitos",
    icon: ClipboardList,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "remitos",
    section: "COMERCIAL PLANTA",
  },
  {
    href: "/despachos",
    label: "Despachos",
    icon: Send,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "despachos",
    section: "COMERCIAL PLANTA",
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

  // Secciones colapsadas (STOCK, COMERCIAL PLANTA, ...): sin esto la
  // lista crece sin fin a medida que se suman módulos de la fusión con
  // Gestión de Luminarias. Se guarda en localStorage para que la
  // preferencia de cada uno se mantenga entre sesiones — es una
  // comodidad de UI por navegador, no datos que haya que leer de vuelta
  // desde el servidor.
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("payflow-sidebar-collapsed");
      if (raw) setCollapsedSections(JSON.parse(raw));
    } catch {
      // localStorage puede fallar (modo privado, storage bloqueado) — la
      // barra simplemente arranca con el default de abajo.
    }
  }, []);

  const visibleItems = navItems
    .filter((item) => item.roles.includes(role))
    .filter((item) => !item.moduleKey || !restrictedModules.includes(item.moduleKey));

  // Secciones que contienen la ruta activa: arrancan expandidas aunque
  // todavía no haya preferencia guardada para esa sección.
  const sectionsConRutaActiva = new Set(
    visibleItems.filter((item) => item.section && item.href === pathname).map((item) => item.section!)
  );

  function toggleSection(section: string, expandidaPorDefault: boolean) {
    setCollapsedSections((prev) => {
      const colapsadaActual = prev[section] ?? !expandidaPorDefault;
      const next = { ...prev, [section]: !colapsadaActual };
      try {
        localStorage.setItem("payflow-sidebar-collapsed", JSON.stringify(next));
      } catch {
        // Ídem arriba: si falla, el toggle sigue funcionando en memoria,
        // solo no persiste entre sesiones.
      }
      return next;
    });
  }

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
          {visibleItems.map((item, index) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              // Encabezado de sección: se muestra antes de un ítem cuando
              // su "section" es distinta a la del ítem anterior visible
              // (o es el primero con section). Los módulos sin "section"
              // (todo lo administrativo de siempre) no muestran encabezado
              // y nunca se colapsan.
              const prevSection = index > 0 ? visibleItems[index - 1].section : undefined;
              const showSectionHeader = item.section && item.section !== prevSection;
              const expandidaPorDefault = item.section ? sectionsConRutaActiva.has(item.section) : true;
              const colapsada = item.section
                ? (collapsedSections[item.section] ?? !expandidaPorDefault)
                : false;

              if (item.section && colapsada && !showSectionHeader) {
                // Sección colapsada: no se renderiza ningún ítem salvo su
                // propio encabezado (ya renderizado en la primera vuelta).
                return null;
              }

              return (
                <div key={item.href}>
                  {showSectionHeader && (
                    <button
                      type="button"
                      onClick={() => toggleSection(item.section!, expandidaPorDefault)}
                      className="mb-1 mt-4 flex w-full items-center justify-between px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:mt-1"
                    >
                      {item.section}
                      {colapsada ? (
                        <ChevronRight className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  )}
                  {(!item.section || !colapsada) && (
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md py-1.5 pl-1.5 pr-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        item.special ?? (active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {item.label}
                  </Link>
                  )}
                </div>
              );
            })}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2.5 rounded-md py-1.5 pl-1.5 pr-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <LogOut className="h-4 w-4 text-destructive" />
            </div>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}