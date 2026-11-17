// Igual criterio que iva-conditions.ts/ganancias-conditions.ts: separado de
// src/models/SensorFuente.ts (que importa mongoose) para que un componente
// "use client" pueda importar esta lista sin arrastrar mongoose al bundle
// del browser.
//
// Mismos 9 tipos que usaba el módulo de Sensores y Fuentes en la app
// "Gestión de Luminarias" (fusionada acá) — se mantienen igual para no
// romper la clasificación que ya tenía ITELSA en planta.
export const SENSOR_FUENTE_TIPOS = [
  "sensor",
  "fuente",
  "acoplamiento_flexible",
  "actuador",
  "espejo",
  "iluminacion",
  "interruptor_actuador",
  "modulo_seguridad",
  "soporte",
] as const;

export type SensorFuenteTipo = (typeof SENSOR_FUENTE_TIPOS)[number];

const LABELS: Record<SensorFuenteTipo, string> = {
  sensor: "Sensor",
  fuente: "Fuente",
  acoplamiento_flexible: "Acoplamiento flexible",
  actuador: "Actuador",
  espejo: "Espejo",
  iluminacion: "Iluminación",
  interruptor_actuador: "Interruptor actuador",
  modulo_seguridad: "Módulo de seguridad",
  soporte: "Soporte",
};

export function sensorFuenteTipoLabel(tipo: SensorFuenteTipo): string {
  return LABELS[tipo] ?? tipo;
}