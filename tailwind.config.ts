import type { Config } from "tailwindcss";

// Identidad visual de ITELSA: azul marca #021530 como color primario/de
// acción (reemplaza el azul genérico que había antes de tener marca), fondo
// general beige y tarjetas blancas con esquinas más redondeadas y sombra
// suave en vez de borde — línea "fintech" (Mercury/Ramp/Stripe Dashboard).
const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // "var(--font-sora)" la define next/font/google en layout.tsx (así
      // queda autohosteada en el build, sin pedirla a Google en cada visita).
      // Si por lo que sea no cargó, cae al stack de sistema de siempre.
      fontFamily: {
        sans: [
          "var(--font-sora)",
          "Segoe UI",
          "-apple-system",
          "system-ui",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        border: "hsl(214 32% 91%)",
        background: "hsl(0 0% 100%)",
        // Fondo general de página — beige, separado de `background` (blanco,
        // el que usan inputs/selects) para que las tarjetas blancas se
        // despeguen del fondo en vez de fundirse con él.
        page: "#F6F3EE",
        foreground: "hsl(222 47% 11%)",
        muted: "hsl(210 40% 96%)",
        "muted-foreground": "hsl(215 16% 47%)",
        primary: {
          DEFAULT: "#021530",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(222 47% 11%)",
        },
        destructive: {
          DEFAULT: "hsl(0 72% 51%)",
          foreground: "hsl(0 0% 100%)",
        },
        // success/warning: oscurecidos respecto al valor original (142 71% 45%
        // y 38 92% 50%) porque esos no pasaban contraste WCAG AA contra fondo
        // blanco (2.30:1 y 2.14:1 — el mínimo exigido es 4.5:1 para texto
        // normal). Mismo tono y saturación, solo más oscuros: 4.58:1 y 4.62:1.
        success: {
          DEFAULT: "hsl(142 71% 31%)",
          foreground: "hsl(0 0% 100%)",
        },
        warning: {
          DEFAULT: "hsl(38 92% 33%)",
          foreground: "hsl(0 0% 100%)",
        },
        violet: {
          DEFAULT: "hsl(262 83% 58%)",
          foreground: "hsl(0 0% 100%)",
        },
      },
      // Un escalón más redondeado que antes (0.75/0.5/0.375rem) — hace que
      // cards, botones, inputs y el modal se sientan menos "cuadrados" sin
      // tener que tocar cada componente uno por uno.
      borderRadius: {
        lg: "1.25rem",
        md: "0.75rem",
        sm: "0.5rem",
      },
    },
  },
  plugins: [],
};

export default config;