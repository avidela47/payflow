"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, CheckCircle, PackagePlus, Play, Settings2, X } from "lucide-react";
import {
  listarProyectosActivos,
  tomarProyecto,
  cargarAvanceProyecto,
  marcarProyectoListo,
  type ProyectoActivo,
} from "@/app/(dashboard)/proyectos/actions";

export type OperarioOption = { id: string; nombre: string };

// Pantalla kiosco de taller — replica la UX real del original (polling +
// alerta sonora + selector de operario a mano, sin login individual),
// confirmado con Ariel el 2026-11-23. Dos diferencias deliberadas:
// - El operario se elige de Empleados activos en vez de un array
//   hardcodeado ('Fabio', 'Cristian', 'Pajarito') — instrucción explícita
//   de Ariel.
// - "Gestionar proyectos" solo se muestra a OWNER (el original lo
//   mostraba solo a rol 'admin') — mismo criterio, adaptado a los roles
//   de PayFlow.
const ESTADO_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  NUEVO: { color: "#f59e0b", bg: "#f59e0b22", label: "NUEVO" },
  PREPARACION: { color: "#3b82f6", bg: "#3b82f622", label: "PREPARACIÓN" },
  FABRICACION: { color: "#2d7d78", bg: "#2d7d7822", label: "FABRICACIÓN" },
};

type AccionTipo = "tomar" | "avance" | "listo";

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
  operarios,
  esAdmin,
}: {
  initialProyectos: ProyectoActivo[];
  operarios: OperarioOption[];
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [proyectos, setProyectos] = useState<ProyectoActivo[]>(initialProyectos);
  const [modalAccion, setModalAccion] = useState<{ proyecto: ProyectoActivo; tipo: AccionTipo } | null>(
    null
  );
  const [itemSel, setItemSel] = useState("");
  const [cantidadSel, setCantidadSel] = useState("");
  const [operarioSel, setOperarioSel] = useState("");
  const [errorModal, setErrorModal] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [alertaNueva, setAlertaNueva] = useState<ProyectoActivo | null>(null);
  const idsConocidos = useRef<Set<string>>(new Set(initialProyectos.map((p) => p.id)));

  const cargar = useCallback(async () => {
    const activos = await listarProyectosActivos();

    const conocidosAntes = idsConocidos.current;
    const nuevos = activos.filter((p) => p.estado === "NUEVO" && !conocidosAntes.has(p.id));
    if (nuevos.length > 0) {
      setAlertaNueva(nuevos[0]);
      reproducirAlerta();
    }
    idsConocidos.current = new Set(activos.map((p) => p.id));
    setProyectos(activos);
  }, []);

  useEffect(() => {
    const interval = setInterval(cargar, 8000);
    return () => clearInterval(interval);
  }, [cargar]);

  function abrirModal(proyecto: ProyectoActivo, tipo: AccionTipo) {
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

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#0a0f16", color: "#e2e8f0" }}
    >
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
              Proyectos en producción
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

        {proyectos.length === 0 ? (
          <div className="py-20 text-center text-base" style={{ color: "#64748b" }}>
            No hay proyectos pendientes 🎉
          </div>
        ) : (
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}
          >
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
              NUEVO PROYECTO DE FÁBRICA
            </div>
            <div className="mb-2 text-3xl font-extrabold text-white">{alertaNueva.numero}</div>
            <div className="mb-7 text-[15px]" style={{ color: "#94a3b8" }}>
              {alertaNueva.cliente}
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
