// Specs de luminaria — calcado de CG_SPECS en
// /tmp/protectos-itelsa/index.html (líneas 2046-2053): mismas 5 claves,
// mismas opciones de datalist/autocompletado. Son las mismas specs tanto en
// la base (valor por defecto de la luminaria) como en cada ítem de un
// cómputo — ahí se pueden pisar sin tocar la base (ej: misma luminaria con
// otro ángulo en este proyecto puntual).
export type SpecKey = "potencia" | "angulo" | "temperatura" | "protocolo" | "tension";

export type SpecDef = {
  k: SpecKey;
  label: string;
  placeholder: string;
  opts: string[];
};

export const SPECS: SpecDef[] = [
  { k: "potencia", label: "Potencia", placeholder: "Ej: 200 W", opts: [] },
  {
    k: "angulo",
    label: "Ángulo",
    placeholder: "Ej: 30°",
    opts: ["10°", "15°", "25°", "30°", "45°", "60°", "90°", "120°", "Asimétrico"],
  },
  {
    k: "temperatura",
    label: "Temperatura de color",
    placeholder: "Ej: 3000K / RGBW",
    opts: ["2700K", "3000K", "4000K", "5000K", "5700K", "6500K", "RGB", "RGBW", "RGBA", "Tunable White"],
  },
  {
    k: "protocolo",
    label: "Protocolo de comunicación",
    placeholder: "Ej: DMX512",
    opts: [
      "Sin control (On/Off)",
      "DMX512",
      "DMX-RDM",
      "DALI",
      "DALI-2",
      "0-10V",
      "1-10V",
      "PWM",
      "Casambi",
      "Zigbee",
      "Bluetooth Mesh",
    ],
  },
  {
    k: "tension",
    label: "Tensión de entrada",
    placeholder: "Ej: 220 V AC",
    opts: ["220 V AC", "100-277 V AC", "380 V AC", "12 V DC", "24 V DC", "48 V DC"],
  },
];

export type SpecValues = Partial<Record<SpecKey, string>>;

export function specsTxt(o: SpecValues | undefined): string {
  if (!o) return "";
  return SPECS.map((s) => o[s.k] || "")
    .filter(Boolean)
    .join(" · ");
}

export function specsOf(o: SpecValues | undefined): SpecValues {
  const r: SpecValues = {};
  SPECS.forEach((s) => {
    r[s.k] = (o && o[s.k]) || "";
  });
  return r;
}

export function normTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
