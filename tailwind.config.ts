import type { Config } from "tailwindcss";

// Paleta neutra y clara, lista para reemplazar por la marca cuando llegue el logo.
// Cambiá solo estos valores (o los de globals.css) y el resto de la UI se actualiza sola.
const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Stack de fuentes del sistema — sin depender de bajar nada de
      // Google Fonts en el build (menos una cosa que puede fallar). Se ve
      // moderna y nítida en Windows/Mac/Linux sin tocar nada más.
      fontFamily: {
        sans: [
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
        foreground: "hsl(222 47% 11%)",
        muted: "hsl(210 40% 96%)",
        "muted-foreground": "hsl(215 16% 47%)",
        primary: {
          DEFAULT: "hsl(221 83% 53%)",
          foreground: "hsl(0 0% 100%)",
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
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [],
};

export default config;