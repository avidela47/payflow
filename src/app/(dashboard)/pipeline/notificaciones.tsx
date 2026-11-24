"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { dbProyectos } from "@/lib/firebase-proyectos";
import { ACTIVITY_SEEN_KEY, type ActivityEntry } from "@/lib/proyectos-activity";
import { teamMemberById } from "@/lib/proyectos-team";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

function ft(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  const dias = Math.floor(hs / 24);
  if (dias < 7) return `hace ${dias} d`;
  return new Date(ts).toLocaleDateString("es-AR");
}

export function Notificaciones({ nombresProyectos, quienSos }: { nombresProyectos: string[]; quienSos: string }) {
  const [todas, setTodas] = useState<ActivityEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);

  useEffect(() => {
    try {
      setLastSeen(Number(localStorage.getItem(ACTIVITY_SEEN_KEY)) || 0);
    } catch {
      setLastSeen(0);
    }
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(dbProyectos, "activity"), (snap) => {
      const items = snap.docs.map((d) => d.data() as ActivityEntry);
      items.sort((a, b) => b.ts - a.ts);
      setTodas(items);
    });
    return () => unsub();
  }, []);

  // Solo actividad de proyectos que existen hoy en esta pestaña (ver nota en
  // proyectos-activity.ts: la colección es global y no trae sección propia).
  const nombresSet = useMemo(() => new Set(nombresProyectos), [nombresProyectos]);
  const items = useMemo(() => todas.filter((a) => nombresSet.has(a.projName)).slice(0, 50), [todas, nombresSet]);

  const sinVer = items.filter((a) => a.ts > lastSeen && a.who !== quienSos).length;

  function abrir() {
    setOpen(true);
    const now = Date.now();
    setLastSeen(now);
    try {
      localStorage.setItem(ACTIVITY_SEEN_KEY, String(now));
    } catch {
      // localStorage puede fallar (modo privado) — el badge solo no persiste.
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="relative" onClick={abrir} title="Notificaciones">
        <Bell className="h-4 w-4" />
        {sinVer > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
            {sinVer > 9 ? "9+" : sinVer}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen} title="Notificaciones" className="max-w-lg">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin actividad reciente.</p>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
            {items.map((a) => {
              const quien = teamMemberById(a.who);
              const esNueva = a.ts > lastSeen && a.who !== quienSos;
              return (
                <div
                  key={a.id}
                  className={`flex items-start gap-3 rounded-md border p-3 ${
                    esNueva ? "border-primary/30 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {quien?.initials ?? "?"}
                  </div>
                  <div className="flex-1 text-sm">
                    <p>
                      <span className="font-medium">{quien?.name ?? "Alguien"}</span> {a.action}
                    </p>
                    <p className="text-xs font-medium text-primary">{a.projName}</p>
                    <p className="text-xs text-muted-foreground">{ft(a.ts)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Dialog>
    </>
  );
}
