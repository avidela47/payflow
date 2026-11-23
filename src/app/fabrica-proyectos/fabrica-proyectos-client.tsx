"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, CheckCircle, PackagePlus, Play, Plus, Settings2, Trash2, X } from "lucide-react";
import {
  listarProyectosActivos,
  tomarProyecto,
  cargarAvanceProyecto,
  marcarProyectoListo,
  type ProyectoActivo,
} from "@/app/(dashboard)/proyectos/actions";
import {
  listarReparacionesActivas,
  tomarReparacion,
  ejecutarReparacion,
  type ReparacionActiva,
} from "@/app/(dashboard)/reparaciones/actions";

export type OperarioOption = { id: string; nombre: string };
export type ComponenteOption = { id: string; codigo: string; descripcion: string; stockActual: number };

// Pantalla kiosco de taller — replica la UX real del original (polling +
// alerta sonora + selector de operario a mano, sin login individual),
// confirmado con Ariel el 2026-11-23. Dos diferencias deliberadas:
// - El operario se elige de Empleados activos en vez de un array
//   hardcodeado ('Fabio', 'Cristian', 'Pajarito') — instrucción explícita
//   de Ariel.
// - "Gestionar proyectos" solo se muestra a OWNER (el original lo
//   mostraba solo a rol 'admin') — mismo criterio, adaptado a los roles
//   de PayFlow.
//
// Ampliado el mismo día: Ariel pidió que el taller vea también las
// Reparaciones pendientes en esta misma pantalla, con la misma alerta
// sonora/visual que un Proyecto nuevo, y un proceso de tomar/marcar lista
// que registre quién la repara — calcado del circuito de Proyecto
// (Tomar → trabajar → Listo), ver reparacion-estados.ts. Por eso hay dos
// grillas independientes (Proyectos / Reparaciones), cada una con su
// propio polling, su propio Set de IDs conocidos (para no cruzar alertas
// entre las dos entidades) y su propia alerta — pero comparten el mismo
// selector de operario (grilla de botones) y el mismo sonido.
const ESTADO_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  NUEVO: { color: "#f59e0b", bg: "#f59e0b22", label: "NUEVO" },
  PREPARACION: { color: "#3b82f6", bg: "#3b82f622", label: "PREPARACIÓN" },
  FABRICACION: { color: "#2d7d78", bg: "#2d7d7822", label: "FABRICACIÓN" },
};

const REPARACION_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  PENDIENTE: { color: "#f59e0b", bg: "#f59e0b22", label: "PENDIENTE" },
  EN_PROCESO: { color: "#3b82f6", bg: "#3b82f622", label: "EN PROCESO" },
};

type AccionProyectoTipo = "tomar" | "avance" | "listo";
type AccionReparacionTipo = "tomar" | "listo";
type ComponenteUsadoForm = { componenteId: string; cantidad: string };

function reproducirAlerta() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const tono = (freq: number, delay: number) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }, delay);
    };
    tono(880, 0);
    tono(1046, 300);
  } catch {
    // Sin soporte de Web Audio (o navegador bloqueando autoplay) — la
    // alerta visual sigue funcionando igual, el sonido es un plus.
  }
}

export function FabricaProyectosClient({
  initialProyectos,
  initialReparaciones,
  operarios,
  componentes,
  mostrarProyectos,
  mostrarReparaciones,
  esAdmin,
}: {
  initialProyectos: ProyectoActivo[];
  initialReparaciones: ReparacionActiva[];
  operarios: OperarioOption[];
  componentes: ComponenteOption[];
  mostrarProyectos: boolean;
  mostrarReparaciones: boolean;
  esAdmin: boolean;
}) {
  const router = useRouter();

  // ---------- Proyectos ----------
  const [proyectos, setProyectos] = useState<ProyectoActivo[]>(initialProyectos);
  const [modalAccion, setModalAccion] = useState<{ proyecto: ProyectoActivo; tipo: AccionProyectoTipo } | null>(
    null
  );
  const [itemSel, setItemSel] = useState("");
  const [cantidadSel, setCantidadSel] = useState("");
  const [operarioSel, setOperarioSel] = useState("");
  const [errorModal, setErrorModal] = useState("");
  const [procesando, setProcesando] = useState(false);
  const idsConocidosProyectos = useRef<Set<string>>(new Set(initialProyectos.map((p) => p.id)));

  // ---------- Reparaciones ----------
  const [reparaciones, setReparaciones] = useState<ReparacionActiva[]>(initialReparaciones);
  const [modalReparacion, setModalReparacion] = useState<{
    reparacion: ReparacionActiva;
    tipo: AccionReparacionTipo;
  } | null>(null);
  const [operarioSelRep, setOperarioSelRep] = useState("");
  const [usadosRep, setUsadosRep] = useState<ComponenteUsadoForm[]>([{ componenteId: "", cantidad: "" }]);
  const [errorModalRep, setErrorModalRep] = useState("");
  const [procesandoRep, setProcesandoRep] = useState(false);
  const idsConocidosReparaciones = useRef<Set<string>>(new Set(initialReparaciones.map((r) => r.id)));

  // ---------- Alerta (compartida, distingue el tipo) ----------
  const [alertaNueva, setAlertaNueva] = useState<
    { tipo: "proyecto"; item: ProyectoActivo } | { tipo: "reparacion"; item: ReparacionActiva } | null
  >(null);

  const cargar = useCallback(async () => {
    if (mostrarProyectos) {
      const activos = await listarProyectosActivos();
      const conocidosAntes = idsConocidosProyectos.current;
      const nuevos = activos.filter((p) => p.estado === "NUEVO" && !conocidosAntes.has(p.id));
      if (nuevos.length > 0) {
        setAlertaNueva({ tipo: "proyecto", item: nuevos[0] });
        reproducirAlerta();
      }
      idsConocidosProyectos.current = new Set(activos.map((p) => p.id));
      setProyectos(activos);
    }

    if (mostrarReparaciones) {
      const activas = await listarReparacionesActivas();
      const conocidosAntesRep = idsConocidosReparaciones.current;
      const nuevasRep = activas.filter((r) => r.estado === "PENDIENTE" && !conocidosAntesRep.has(r.id));
      if (nuevasRep.length > 0) {
        setAlertaNueva((prev) => prev ?? { tipo: "reparacion", item: nuevasRep[0] });
        reproducirAlerta();
      }
      idsConocidosReparaciones.current = new Set(activas.map((r) => r.id));
      setReparaciones(activas);
    }
  }, [mostrarProyectos, mostrarReparaciones]);

  useEffect(() => {
    const interval = setInterval(cargar, 8000);
    return () => clearInterval(interval);
  }, [cargar]);

  function abrirModal(proyecto: ProyectoActivo, tipo: AccionProyectoTipo) {
    setModalAccion({ proyecto, tipo });
    setItemSel(proyecto.items.length === 1 ? proyecto.items[0].id : "");
    setCantidadSel("");
    setOperarioSel("");
    setErrorModal("");
  }

  function cerrarModal() {
    setModalAccion(null);
  }

  async function confirmarAccion() {
    if (!modalAccion) return;
    setErrorModal("");
    if (!operarioSel) {
      setErrorModal("Elegí quién realiza la acción.");
      return;
    }

    const { proyecto, tipo } = modalAccion;
    setProcesando(true);

    let result: { ok: boolean; error?: string };
    if (tipo === "tomar") {
      result = await tomarProyecto(proyecto.id, operarioSel);
    } else if (tipo === "listo") {
      result = await marcarProyectoListo(proyecto.id, operarioSel);
    } else {
      if (!itemSel) {
        setProcesando(false);
        setErrorModal("Elegí el modelo.");
        return;
      }
      const cantidad = Number(cantidadSel);
      if (!cantidad || cantidad <= 0) {
        setProcesando(false);
        setErrorModal("Ingresá una cantidad válida.");
        return;
      }
      result = await cargarAvanceProyecto(proyecto.id, { itemId: itemSel, cantidad, operario: operarioSel });
    }

    setProcesando(false);

    if (!result.ok) {
      setErrorModal(result.error ?? "No se pudo completar la acción.");
      return;
    }

    cerrarModal();
    cargar();
  }

  function abrirModalReparacion(reparacion: ReparacionActiva, tipo: AccionReparacionTipo) {
    setModalReparacion({ reparacion, tipo });
    setOperarioSelRep("");
    setUsadosRep([{ componenteId: "", cantidad: "" }]);
    setErrorModalRep("");
  }

  function cerrarModalReparacion() {
    setModalReparacion(null);
  }

  function actualizarUsadoRep(index: number, patch: Partial<ComponenteUsadoForm>) {
    setUsadosRep((prev) => prev.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  }

  function agregarUsadoRep() {
    setUsadosRep((prev) => [...prev, { componenteId: "", cantidad: "" }]);
  }

  function quitarUsadoRep(index: number) {
    setUsadosRep((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function confirmarAccionReparacion() {
    if (!modalReparacion) return;
    setErrorModalRep("");

    const { reparacion, tipo } = modalReparacion;

    if (tipo === "tomar") {
      if (!operarioSelRep) {
        setErrorModalRep("Elegí quién toma la reparación.");
        return;
      }
      setProcesandoRep(true);
      const result = await tomarReparacion(reparacion.id, operarioSelRep);
      setProcesandoRep(false);
      if (!result.ok) {
        setErrorModalRep(result.error ?? "No se pudo completar la acción.");
        return;
      }
      cerrarModalReparacion();
      cargar();
      return;
    }

    const validos = usadosRep.filter((u) => u.componenteId && Number(u.cantidad) > 0);
    if (validos.length === 0) {
      setErrorModalRep("Elegí al menos un componente usado.");
      return;
    }

    setProcesandoRep(true);
    const result = await ejecutarReparacion(
      reparacion.id,
      JSON.stringify(validos.map((u) => ({ componenteId: u.componenteId, cantidad: Number(u.cantidad) })))
    );
    setProcesandoRep(false);

    if (!result.ok) {
      setErrorModalRep(result.error ?? "No se pudo completar la acción.");
      return;
    }
    cerrarModalReparacion();
    cargar();
  }

  const sinNada = proyectos.length === 0 && reparaciones.length === 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0f16", color: "#e2e8f0" }}>
      <div className="mx-auto max-w-[1400px] p-8">
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold"
            style={{ borderColor: "#1e3448", backgroundColor: "#141f2b", color: "#94a3b8" }}
          >
            <ArrowLeft size={14} /> Volver
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-extrabold tracking-wide text-white">ITELSA — FÁBRICA</h1>
            <p className="mt-1.5 text-sm" style={{ color: "#5eead4" }}>
              Proyectos y reparaciones en taller
            </p>
          </div>
          {esAdmin ? (
            <button
              onClick={() => router.push("/proyectos")}
              className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold"
              style={{ borderColor: "#1e3448", backgroundColor: "#141f2b", color: "#5eead4" }}
            >
              <Settings2 size={14} /> Gestionar proyectos
            </button>
          ) : (
            <div className="w-[140px]" />
          )}
        </div>

        {sinNada && (
          <div className="py-20 text-center text-base" style={{ color: "#64748b" }}>
            No hay proyectos ni reparaciones pendientes 🎉
          </div>
        )}

        {mostrarProyectos && proyectos.length > 0 && (
          <div className="mb-10">
            <h2
              className="mb-4 text-xs font-extrabold tracking-[2px]"
              style={{ color: "#5eead4" }}
            >
              PROYECTOS DE FÁBRICA
            </h2>
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
              {proyectos.map((p) => {
                const cfg = ESTADO_CONFIG[p.estado] ?? ESTADO_CONFIG.NUEVO;
                const totalSol = p.items.reduce((a, i) => a + i.cantidadSolicitada, 0);
                const totalComp = p.items.reduce((a, i) => a + i.cantidadCompletada, 0);
                const pct = totalSol > 0 ? Math.round((totalComp / totalSol) * 100) : 0;

                return (
                  <div
                    key={p.id}
                    className="relative overflow-hidden rounded-2xl border p-5"
                    style={{
                      backgroundColor: "#141f2b",
                      borderColor: p.prioridad === "URGENTE" ? "#ef4444" : "#1e3448",
                    }}
                  >
                    {p.prioridad === "URGENTE" && (
                      <div
                        className="absolute right-0 top-0 rounded-bl-[10px] px-3 py-1 text-[10px] font-extrabold text-white"
                        style={{ backgroundColor: "#ef4444" }}
                      >
                        URGENTE
                      </div>
                    )}

                    <div className="mb-2.5 flex items-start justify-between">
                      <div>
                        <div className="text-lg font-extrabold text-white">{p.numero}</div>
                        <div className="text-[13px]" style={{ color: "#94a3b8" }}>
                          {p.cliente}
                          {p.nombre && ` — ${p.nombre}`}
                        </div>
                      </div>
                      <span
                        className="rounded-md px-2.5 py-1 text-[10px] font-bold"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    <div
                      className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full"
                      style={{ backgroundColor: "#1e3448" }}
                    >
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct === 100 ? "#16a34a" : "#2d7d78",
                        }}
                      />
                    </div>
                    <div className="mb-3.5 text-xs" style={{ color: "#64748b" }}>
                      {totalComp}/{totalSol} equipos ({pct}%)
                    </div>

                    <div className="mb-3.5">
                      {p.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex justify-between border-b py-1 text-xs"
                          style={{ borderColor: "#1e3448", color: "#cbd5e1" }}
                        >
                          <span>{it.modelo}</span>
                          <span
                            className="font-bold"
                            style={{ color: it.cantidadCompletada >= it.cantidadSolicitada ? "#16a34a" : "#fff" }}
                          >
                            {it.cantidadCompletada}/{it.cantidadSolicitada}
                          </span>
                        </div>
                      ))}
                    </div>

                    {p.tomadoPor && (
                      <div className="mb-2.5 text-[11px]" style={{ color: "#64748b" }}>
                        Tomado por: <b style={{ color: "#cbd5e1" }}>{p.tomadoPor}</b>
                      </div>
                    )}

                    {p.estado === "NUEVO" && (
                      <button
                        onClick={() => abrirModal(p, "tomar")}
                        className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-bold text-white"
                        style={{ backgroundColor: "#2d7d78" }}
                      >
                        <Play size={15} /> Tomar proyecto
                      </button>
                    )}
                    {(p.estado === "PREPARACION" || p.estado === "FABRICACION") && pct < 100 && (
                      <button
                        onClick={() => abrirModal(p, "avance")}
                        className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-bold"
                        style={{ backgroundColor: "#f59e0b", color: "#1a1a1a" }}
                      >
                        <PackagePlus size={15} /> Cargar avance
                      </button>
                    )}
                    {pct === 100 && (
                      <button
                        onClick={() => abrirModal(p, "listo")}
                        className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-bold text-white"
                        style={{ backgroundColor: "#16a34a" }}
                      >
                        <CheckCircle size={15} /> Marcar como listo
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {mostrarReparaciones && reparaciones.length > 0 && (
          <div>
            <h2
              className="mb-4 text-xs font-extrabold tracking-[2px]"
              style={{ color: "#5eead4" }}
            >
              REPARACIONES
            </h2>
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
              {reparaciones.map((r) => {
                const cfg = REPARACION_CONFIG[r.estado] ?? REPARACION_CONFIG.PENDIENTE;
                const totalCant = r.lineas.reduce((a, l) => a + l.cantidad, 0);

                return (
                  <div
                    key={r.id}
                    className="relative overflow-hidden rounded-2xl border p-5"
                    style={{ backgroundColor: "#141f2b", borderColor: "#1e3448" }}
                  >
                    <div className="mb-2.5 flex items-start justify-between">
                      <div>
                        <div className="text-lg font-extrabold text-white">{r.numero}</div>
                        <div className="text-[13px]" style={{ color: "#94a3b8" }}>
                          {r.razonSocial}
                        </div>
                      </div>
                      <span
                        className="rounded-md px-2.5 py-1 text-[10px] font-bold"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    <div className="mb-3.5 text-xs" style={{ color: "#64748b" }}>
                      {totalCant} {totalCant === 1 ? "luminaria" : "luminarias"} a reparar
                    </div>

                    <div className="mb-3.5">
                      {r.lineas.map((l, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between border-b py-1 text-xs"
                          style={{ borderColor: "#1e3448", color: "#cbd5e1" }}
                        >
                          <span className="truncate">{l.codigoLuminaria ? `${l.codigoLuminaria} — ` : ""}{l.descripcion}</span>
                          <span className="font-bold text-white">{l.cantidad}</span>
                        </div>
                      ))}
                    </div>

                    {r.tomadoPor && (
                      <div className="mb-2.5 text-[11px]" style={{ color: "#64748b" }}>
                        Tomada por: <b style={{ color: "#cbd5e1" }}>{r.tomadoPor}</b>
                      </div>
                    )}

                    {r.estado === "PENDIENTE" && (
                      <button
                        onClick={() => abrirModalReparacion(r, "tomar")}
                        className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-bold text-white"
                        style={{ backgroundColor: "#2d7d78" }}
                      >
                        <Play size={15} /> Tomar reparación
                      </button>
                    )}
                    {r.estado === "EN_PROCESO" && (
                      <button
                        onClick={() => abrirModalReparacion(r, "listo")}
                        className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-bold text-white"
                        style={{ backgroundColor: "#16a34a" }}
                      >
                        <CheckCircle size={15} /> Marcar lista
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {modalAccion && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-5"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl border p-7"
            style={{ backgroundColor: "#141f2b", borderColor: "#1e3448" }}
          >
            <div className="mb-4.5 flex items-center justify-between">
              <span className="text-[15px] font-bold text-white">
                {modalAccion.tipo === "tomar" && "Tomar proyecto"}
                {modalAccion.tipo === "avance" && "Cargar avance"}
                {modalAccion.tipo === "listo" && "Marcar como listo"}
              </span>
              <button onClick={cerrarModal} style={{ color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 text-xs" style={{ color: "#94a3b8" }}>
              {modalAccion.proyecto.numero} — {modalAccion.proyecto.cliente}
            </div>

            <label className="mb-1 block text-[11px] font-semibold" style={{ color: "#94a3b8" }}>
              OPERARIO
            </label>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {operarios.map((op) => (
                <button
                  key={op.id}
                  onClick={() => setOperarioSel(op.nombre)}
                  className="rounded-lg px-1.5 py-2.5 text-xs font-bold"
                  style={{
                    border: operarioSel === op.nombre ? "2px solid #2d7d78" : "1px solid #1e3448",
                    backgroundColor: operarioSel === op.nombre ? "#2d7d7822" : "#0f1923",
                    color: operarioSel === op.nombre ? "#5eead4" : "#94a3b8",
                  }}
                >
                  {op.nombre}
                </button>
              ))}
              {operarios.length === 0 && (
                <p className="col-span-3 text-xs" style={{ color: "#64748b" }}>
                  No hay empleados activos cargados en Empleados.
                </p>
              )}
            </div>

            {modalAccion.tipo === "avance" && (
              <>
                <label className="mb-1 block text-[11px] font-semibold" style={{ color: "#94a3b8" }}>
                  MODELO
                </label>
                <select
                  value={itemSel}
                  onChange={(e) => setItemSel(e.target.value)}
                  className="mb-3 w-full rounded-lg px-2.5 py-2.5 text-[13px] outline-none"
                  style={{ border: "1px solid #1e3448", backgroundColor: "#0f1923", color: "#fff" }}
                >
                  <option value="">Seleccionar...</option>
                  {modalAccion.proyecto.items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.modelo} — pendiente {it.cantidadSolicitada - it.cantidadCompletada}
                    </option>
                  ))}
                </select>

                <label className="mb-1 block text-[11px] font-semibold" style={{ color: "#94a3b8" }}>
                  CANTIDAD FABRICADA
                </label>
                <input
                  type="number"
                  min={1}
                  value={cantidadSel}
                  onChange={(e) => setCantidadSel(e.target.value)}
                  className="mb-4 w-full rounded-lg px-2.5 py-2.5 text-[13px] outline-none"
                  style={{ border: "1px solid #1e3448", backgroundColor: "#0f1923", color: "#fff" }}
                />
              </>
            )}

            {errorModal && (
              <div
                className="mb-3 rounded-lg px-3 py-2 text-xs"
                style={{ backgroundColor: "#ef444422", color: "#f87171" }}
              >
                {errorModal}
              </div>
            )}

            <button
              onClick={confirmarAccion}
              disabled={procesando}
              className="w-full rounded-lg py-3 text-sm font-bold text-white"
              style={{ backgroundColor: "#2d7d78", opacity: procesando ? 0.6 : 1 }}
            >
              {procesando ? "Procesando..." : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {modalReparacion && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-5"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="w-full max-w-[460px] rounded-2xl border p-7"
            style={{ backgroundColor: "#141f2b", borderColor: "#1e3448" }}
          >
            <div className="mb-4.5 flex items-center justify-between">
              <span className="text-[15px] font-bold text-white">
                {modalReparacion.tipo === "tomar" ? "Tomar reparación" : "Marcar reparación lista"}
              </span>
              <button onClick={cerrarModalReparacion} style={{ color: "#64748b" }}>
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 text-xs" style={{ color: "#94a3b8" }}>
              {modalReparacion.reparacion.numero} — {modalReparacion.reparacion.razonSocial}
            </div>

            {modalReparacion.tipo === "tomar" && (
              <>
                <label className="mb-1 block text-[11px] font-semibold" style={{ color: "#94a3b8" }}>
                  OPERARIO
                </label>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {operarios.map((op) => (
                    <button
                      key={op.id}
                      onClick={() => setOperarioSelRep(op.nombre)}
                      className="rounded-lg px-1.5 py-2.5 text-xs font-bold"
                      style={{
                        border: operarioSelRep === op.nombre ? "2px solid #2d7d78" : "1px solid #1e3448",
                        backgroundColor: operarioSelRep === op.nombre ? "#2d7d7822" : "#0f1923",
                        color: operarioSelRep === op.nombre ? "#5eead4" : "#94a3b8",
                      }}
                    >
                      {op.nombre}
                    </button>
                  ))}
                  {operarios.length === 0 && (
                    <p className="col-span-3 text-xs" style={{ color: "#64748b" }}>
                      No hay empleados activos cargados en Empleados.
                    </p>
                  )}
                </div>
              </>
            )}

            {modalReparacion.tipo === "listo" && (
              <>
                <label className="mb-1 block text-[11px] font-semibold" style={{ color: "#94a3b8" }}>
                  COMPONENTES USADOS
                </label>
                <div className="mb-3 flex flex-col gap-2 rounded-lg border p-2" style={{ borderColor: "#1e3448" }}>
                  {usadosRep.map((u, index) => (
                    <div key={index} className="grid grid-cols-12 items-center gap-2">
                      <select
                        value={u.componenteId}
                        onChange={(e) => actualizarUsadoRep(index, { componenteId: e.target.value })}
                        className="col-span-7 rounded-lg px-2 py-2 text-xs outline-none"
                        style={{ border: "1px solid #1e3448", backgroundColor: "#0f1923", color: "#fff" }}
                      >
                        <option value="">Elegir componente...</option>
                        {componentes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.codigo} (stock: {c.stockActual})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={u.cantidad}
                        onChange={(e) => actualizarUsadoRep(index, { cantidad: e.target.value })}
                        className="col-span-3 rounded-lg px-2 py-2 text-xs outline-none"
                        style={{ border: "1px solid #1e3448", backgroundColor: "#0f1923", color: "#fff" }}
                      />
                      <button
                        onClick={() => quitarUsadoRep(index)}
                        className="col-span-2 flex items-center justify-center rounded-lg py-2"
                        style={{ backgroundColor: "#ef444422", color: "#f87171" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={agregarUsadoRep}
                  className="mb-4 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold"
                  style={{ borderColor: "#1e3448", color: "#94a3b8" }}
                >
                  <Plus size={13} /> Agregar componente
                </button>
              </>
            )}

            {errorModalRep && (
              <div
                className="mb-3 rounded-lg px-3 py-2 text-xs"
                style={{ backgroundColor: "#ef444422", color: "#f87171" }}
              >
                {errorModalRep}
              </div>
            )}

            <button
              onClick={confirmarAccionReparacion}
              disabled={procesandoRep}
              className="w-full rounded-lg py-3 text-sm font-bold text-white"
              style={{ backgroundColor: "#2d7d78", opacity: procesandoRep ? 0.6 : 1 }}
            >
              {procesandoRep ? "Procesando..." : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {alertaNueva && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center p-5"
          style={{ backgroundColor: "rgba(220,38,38,0.15)" }}
        >
          <div
            className="w-full max-w-[480px] rounded-[20px] border-[3px] p-12 text-center"
            style={{
              backgroundColor: "#141f2b",
              borderColor: "#ef4444",
              boxShadow: "0 0 60px rgba(239,68,68,0.5)",
            }}
          >
            <Bell size={56} color="#ef4444" style={{ margin: "0 auto 16px" }} />
            <div className="mb-2 text-[13px] font-bold tracking-[2px]" style={{ color: "#f87171" }}>
              {alertaNueva.tipo === "proyecto" ? "NUEVO PROYECTO DE FÁBRICA" : "NUEVA REPARACIÓN"}
            </div>
            <div className="mb-2 text-3xl font-extrabold text-white">{alertaNueva.item.numero}</div>
            <div className="mb-7 text-[15px]" style={{ color: "#94a3b8" }}>
              {alertaNueva.tipo === "proyecto" ? alertaNueva.item.cliente : alertaNueva.item.razonSocial}
            </div>
            <button
              onClick={() => setAlertaNueva(null)}
              className="rounded-xl px-8 py-3 text-[15px] font-bold text-white"
              style={{ backgroundColor: "#ef4444" }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
