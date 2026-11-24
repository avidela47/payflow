"use client";

import { useEffect, useState } from "react";
import { TEAM, PROYECTOS_IDENTITY_KEY, type TeamMember } from "@/lib/proyectos-team";

// Hook compartido entre /pipeline y /pipeline/[id]: lee/guarda en localStorage
// quién eligió ser en el selector "¿Quién sos?" (ver QuienSos más abajo). Se
// repite acá en vez de vivir solo en la lista porque el detalle también
// necesita saber quién sos para notificar por email sin incluirte a vos
// mismo entre los destinatarios.
export function useQuienSos() {
  const [quienSos, setQuienSosState] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    try {
      setQuienSosState(localStorage.getItem(PROYECTOS_IDENTITY_KEY));
    } catch {
      setQuienSosState(null);
    }
  }, []);

  function elegir(m: TeamMember) {
    try {
      localStorage.setItem(PROYECTOS_IDENTITY_KEY, m.id);
    } catch {
      // localStorage puede fallar (modo privado) — sigue funcionando en
      // memoria para esta sesión, solo no persiste.
    }
    setQuienSosState(m.id);
  }

  return { quienSos, elegir };
}

export function QuienSos({ onElegir }: { onElegir: (m: TeamMember) => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
      <p className="text-sm font-medium">¿Quién sos?</p>
      <div className="flex flex-wrap justify-center gap-2">
        {TEAM.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onElegir(m)}
            className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-full border border-border bg-muted text-sm font-semibold hover:bg-primary/10 hover:text-primary"
          >
            {m.initials}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Define quién sos para asignarte tareas y notificaciones — no es tu login de PayFlow.
      </p>
    </div>
  );
}
