import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// `variable` expone la fuente como --font-sora (referenciada en
// tailwind.config.ts); Next la descarga una vez en build time y la sirve
// desde el propio dominio, no desde fonts.googleapis.com en cada visita.
const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "ITELSA SAS | PayFlow — ",
  description: "Sueldos, costos fijos, cheques y horas en un solo lugar.",
};

// Sin esto, el celular asume que la página es de escritorio (~980px de
// ancho virtual) y las clases responsive (md:...) nunca se activan en un
// teléfono real, aunque compilen y funcionen perfecto en el navegador de
// la PC achicando la ventana.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={sora.variable}>
      <body className="font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}