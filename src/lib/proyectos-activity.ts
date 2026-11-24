// Feed de actividad de la pestaña "Proyectos" — misma colección global
// "activity" que usa /tmp/protectos-itelsa/index.html (logActivity, línea
// 1597), compartida con TODAS las pestañas del tablero original (Accesos,
// Weeklys, Cómputos, Cómputo privado, Arquitectura, Proyectos/Gestión).
//
// Esa colección NO tiene campo de departamento/sección — cada entrada es
// {id, action, projName, who, ts} y nada más. Por eso acá se filtra, al
// leer, por nombre de proyecto contra los proyectos reales de esta pestaña
// (sección "pipeline"): mostrar el feed global tal cual sería mezclar avisos
// de Weeklys/Accesos/Cómputos que PayFlow ni siquiera tiene. Es una decisión
// a propósito, no un capricho — el original no da otra forma de distinguir.
//
// Efecto secundario conocido: si se borra un proyecto, sus entradas viejas
// de actividad dejan de verse acá (ya no matchean ningún nombre actual),
// aunque el documento siga existiendo en Firestore. Aceptado como costo
// menor de no tener projId en la colección original.
import { collection, doc, setDoc } from "firebase/firestore";
import { dbProyectos } from "./firebase-proyectos";

export type ActivityEntry = {
  id: string;
  action: string;
  projName: string;
  who: string;
  ts: number;
};

export const ACTIVITY_SEEN_KEY = "payflow_proyectos_seen_notif";

export function logActivity(action: string, projName: string, quienSosId: string): void {
  const ref = doc(collection(dbProyectos, "activity"));
  const entry: ActivityEntry = {
    id: ref.id,
    action,
    projName,
    who: quienSosId,
    ts: Date.now(),
  };
  void setDoc(ref, entry);
}
