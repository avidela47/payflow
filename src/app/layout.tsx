import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayFlow — ITELSA",
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
    <html lang="es">
      <body className="font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}