"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FolderKanban,
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
  Gavel,
  CreditCard,
  Zap,
  Lightbulb,
  Wrench,
  Package,
  FileText,
  ChevronDown,
  ChevronRight,
  PencilRuler,
  HardHat,
  Target,
  Lock,
  ClipboardList,
  Send,
  HandCoins,
  Puzzle,
  ListTree,
  ArrowLeftRight,
  Factory,
  Radio,
  ClipboardCheck,
  Hammer,
  FileSignature,
  Calculator,
  BadgeDollarSign,
  Megaphone,
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

// Reorganización de los módulos originales de PayFlow por sección
// (2026-11-24, a pedido de Ariel: "armalo por sección... hablo sobretodo
// las que quedaron original de payflow, no las mudadas"). Hasta acá estos
// ~17 ítems eran una lista plana sin agrupar, mientras que los módulos de
// la fusión con Gestión de Luminarias ya tenían sus 3 secciones propias
// (PRODUCCIÓN/STOCK/COMERCIAL PLANTA, ver abajo). Dashboard y Reportes
// quedan sin sección a propósito — son accesos globales (inicio y, dentro
// de Reportes, un único ítem de menú que cubre los 10 reportes), no
// módulos de un área puntual. El resto se agrupa por para qué se usa:
// COMERCIAL (contactos y el registro comercial de siempre, separado de
// COMERCIAL PLANTA que es el circuito de documentos de planta), FINANZAS
// (todo lo que mira la contadora: legajos, sueldos, gastos, cheques,
// caja, viáticos — PayFlow nació para esto) y UTILIDADES (utilidades
// personales: agenda, calendario, notas, vault). Orden de secciones de
// arriba a abajo: accesos globales, administrativo (razón de ser
// original de la app), planta (lo que se fue sumando con la fusión).
const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["OWNER", "ACCOUNTANT"] },
  {
    href: "/reportes",
    label: "Reportes",
    icon: FileBarChart,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "reportes",
  },
  // Weeklys — prioridades macro de la empresa y meets con líderes de área.
  // Colección Firestore propia "weeklys", sin relación con "projects".
  // Primera pestaña del tablero original (DEPTS), por eso va primera acá
  // también dentro de PROYECTOS.
  {
    href: "/weeklys",
    label: "Weeklys",
    icon: Target,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "weeklys",
    section: "PROYECTOS",
  },
  // Pestaña "Proyectos" del ex proyectos-itelsa, portada a React dentro de
  // PayFlow pero conectada EN VIVO a la misma Firestore real (ver
  // src/lib/firebase-proyectos.ts) — no es un clon con datos propios, es la
  // misma app de siempre con el chrome de PayFlow alrededor. Ruta interna
  // "/pipeline" (no "/proyectos") a propósito: PayFlow ya tiene un modelo
  // Proyecto para producción de fábrica en esa ruta — mismo criterio de
  // evitar colisión de nombres que la versión anterior de este módulo.
  {
    href: "/pipeline",
    label: "Proyectos",
    icon: FolderKanban,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "pipeline",
    section: "PROYECTOS",
  },
  // Pestaña "Generador de computos" del ex proyectos-itelsa, misma lógica
  // que Proyectos arriba: conectada en vivo a la misma Firestore real
  // (colecciones "luminarias" y "computosGen"), portada por fases — esta es
  // la Fase 1 (base de luminarias + armado del cómputo, sin PDF/plano/
  // historial todavía).
  {
    href: "/computos",
    label: "Generador de Cómputos",
    icon: Calculator,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "computos",
    section: "PROYECTOS",
  },
  // Arquitectura — mismo motor que Proyectos (pipeline-client.tsx
  // parametrizado por `section`), misma base Firestore real que
  // proyectos-itelsa.itelsasas.com. Fase 1a de portar esa app completa.
  {
    href: "/arquitectura",
    label: "Arquitectura",
    icon: PencilRuler,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "arquitectura",
    section: "PROYECTOS",
  },
  // Accesos — caja fuerte COMPARTIDA del equipo (un PIN para todos), a
  // propósito separada del Vault de PayFlow (icono distinto a propósito:
  // KeyRound ya es Vault, acá va Lock para no confundirlos en el menú).
  {
    href: "/accesos",
    label: "Accesos",
    icon: Lock,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "accesos",
    section: "PROYECTOS",
  },
  // Gestión de Proyectos — Fase 1b. Mismo motor que Proyectos/Arquitectura,
  // pero el detalle agrega 6 bloques propios de seguimiento de obra (seguros,
  // alojamiento, contactos, checklist, Gantt, informes) en vez de
  // Necesario/Cómputos aprobados.
  {
    href: "/gestion-de-proyectos",
    label: "Gestión de Proyectos",
    icon: HardHat,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "gestion-de-proyectos",
    section: "PROYECTOS",
  },
  // Cómputo Privado — toma un cómputo CERRADO de Generador de Cómputos y arma
  // una planilla valorizada (con precios). PIN propio, distinto al de Accesos
  // (ver computo-privado-crypto.ts) — ícono también distinto a propósito
  // (BadgeDollarSign: ni Lock de Accesos ni Calculator de Generador de
  // Cómputos, para no confundirlas en el menú).
  {
    href: "/computo-privado",
    label: "Cómputo Privado",
    icon: BadgeDollarSign,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "computo-privado",
    section: "PROYECTOS",
  },
  // Marketing & Task — recortado a lo que de verdad se usaba en el original
  // (2026-11-25, Ariel): Tareas generales + calendario de contenidos +
  // Recordatorios. Sin el importador de "plan de redes" (datos de un solo
  // mes hardcodeados) ni "Proyectos de marketing" (nunca conectado a
  // ninguna pantalla en la app vieja).
  {
    href: "/marketing",
    label: "Marketing & Task",
    icon: Megaphone,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "marketing",
    section: "PROYECTOS",
  },
  { href: "/clientes", label: "Clientes", icon: Building2, roles: ["OWNER", "ACCOUNTANT"], section: "COMERCIAL" },
  { href: "/proveedores", label: "Proveedores", icon: Truck, roles: ["OWNER", "ACCOUNTANT"], section: "COMERCIAL" },
  { href: "/ventas", label: "Ventas", icon: TrendingUp, roles: ["OWNER", "ACCOUNTANT"], section: "COMERCIAL" },
  { href: "/compras", label: "Compras", icon: ShoppingCart, roles: ["OWNER", "ACCOUNTANT"], section: "COMERCIAL" },
  {
    href: "/empleados",
    label: "Empleados",
    icon: Users,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "empleados",
    section: "FINANZAS",
  },
  {
    href: "/sueldos",
    label: "Sueldos",
    icon: Wallet,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "sueldos",
    section: "FINANZAS",
  },
  {
    href: "/costos-fijos",
    label: "Costos Fijos",
    icon: Receipt,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "costos-fijos",
    section: "FINANZAS",
  },
  {
    href: "/pagos",
    label: "Pagos",
    icon: CreditCard,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "pagos",
    section: "FINANZAS",
  },
  {
    href: "/cheques",
    label: "Cheques",
    icon: Landmark,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "cheques",
    section: "FINANZAS",
  },
  {
    href: "/caja-chica",
    label: "Caja Chica",
    icon: Banknote,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "caja-chica",
    section: "FINANZAS",
  },
  {
    href: "/viaticos",
    label: "Viajes",
    icon: Plane,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "viaticos",
    section: "FINANZAS",
  },
  {
    href: "/licitaciones",
    label: "Licitaciones",
    icon: Gavel,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "licitaciones",
    section: "FINANZAS",
  },
  { href: "/agenda", label: "Agenda", icon: CalendarClock, roles: ["OWNER", "ACCOUNTANT"], section: "UTILIDADES" },
  { href: "/calendario", label: "Calendario", icon: CalendarDays, roles: ["OWNER", "ACCOUNTANT"], section: "UTILIDADES" },
  {
    href: "/vault",
    label: "Vault",
    icon: KeyRound,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "vault",
    section: "UTILIDADES",
  },
  {
    href: "/notas",
    label: "Notas",
    icon: StickyNote,
    roles: ["OWNER", "ACCOUNTANT"],
    section: "UTILIDADES",
    // Única excepción al acento único: post-it amarillo a propósito.
    special: "bg-yellow-100 text-yellow-700",
  },
  // Fase 5 de la fusión (Producción): sección nueva, separada de STOCK.
  // Completa con Componentes, Recetas (BOM), Fabricar, el historial de
  // Movimientos y Proyectos Fábrica (ver planificacion/fusion-gestion-
  // luminarias.md). El orden Componentes → Recetas → Fabricar →
  // Movimientos sigue el mismo orden real del menú de Sistema de Fábrica
  // (components/Sidebar.tsx del original). Corregido
  // 2026-11-22: al principio Componentes había entrado en STOCK con los
  // movimientos embebidos adentro de la tabla — Ariel lo comparó contra la
  // pantalla real de Sistema de Fábrica (que tiene Componentes y
  // Movimientos como dos pantallas separadas, en su propia sección
  // "Producción") y se corrigió para igualar eso.
  {
    href: "/componentes",
    label: "Componentes",
    icon: Puzzle,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "componentes",
    section: "PRODUCCIÓN",
  },
  {
    href: "/recetas",
    label: "Recetas (BOM)",
    icon: ListTree,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "recetas",
    section: "PRODUCCIÓN",
  },
  {
    href: "/fabricar",
    label: "Fabricar",
    icon: Factory,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "fabricar",
    section: "PRODUCCIÓN",
  },
  {
    href: "/movimientos-componentes",
    label: "Movimientos",
    icon: ArrowLeftRight,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "movimientos-componentes",
    section: "PRODUCCIÓN",
  },
  // Pantalla kiosco de taller (/fabrica-proyectos) — fuera del grupo de
  // rutas (dashboard) a propósito (sin sidebar propia dentro de ella,
  // ver fabrica-proyectos/page.tsx), pero el acceso desde el menú vive
  // acá igual que en el original (un solo ítem de menú para esta
  // pantalla; la administración de /proyectos se llega desde el botón
  // "Gestionar proyectos" de la pantalla kiosco, no desde el sidebar —
  // mismo criterio real que el original).
  {
    href: "/fabrica-proyectos",
    label: "Proyectos Fábrica",
    icon: Radio,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "proyectos",
    section: "PRODUCCIÓN",
  },
  // Fase 6 (2026-11-24): préstamo interno de herramientas/stock/otros —
  // confirmado por Ariel que pertenece a Producción, no a Comercial (ver
  // planificacion/fusion-gestion-luminarias.md). Ficha de control, no
  // mueve stock de ningún catálogo (ver models/Vale.ts).
  {
    href: "/vales",
    label: "Vales",
    icon: FileSignature,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "vales",
    section: "PRODUCCIÓN",
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
    href: "/ordenes",
    label: "Órdenes de Trabajo",
    icon: ClipboardCheck,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "ordenes",
    section: "COMERCIAL PLANTA",
  },
  {
    href: "/reparaciones",
    label: "Reparaciones",
    icon: Hammer,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "reparaciones",
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
  {
    href: "/recibos",
    label: "Recibos",
    icon: HandCoins,
    roles: ["OWNER", "ACCOUNTANT"],
    moduleKey: "recibos",
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