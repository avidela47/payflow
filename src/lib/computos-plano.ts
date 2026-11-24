// Procesamiento del plano del cómputo (imagen o primera página de un PDF) —
// port de cgCanvasToJpeg/cgSubirPlano en el original
// (/tmp/protectos-itelsa/index.html, líneas ~2395-2440). A diferencia de la
// foto de luminaria (comprimirImagen en computos-image.ts, máx 400px), acá
// el máximo es 2400px porque el plano necesita legibilidad de detalle — por
// eso vive en su propia colección Firestore "gfiles" en vez de un campo del
// cómputo (mismo límite ~950KB por documento que el original).
//
// pdf.js se carga igual que el original: como script global desde CDN, bajo
// demanda y solo si el archivo subido es un PDF — no como dependencia npm,
// para no meterse con la configuración de web workers de Next.js (el
// original tampoco lo importa como módulo, lo inyecta como <script>).

type PdfJsViewport = { width: number; height: number };
type PdfJsPage = {
  getViewport: (opts: { scale: number }) => PdfJsViewport;
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: PdfJsViewport }) => { promise: Promise<void> };
};
type PdfJsDocument = { getPage: (n: number) => Promise<PdfJsPage> };
type PdfJsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<PdfJsDocument> };
};

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

function cargarPdfJs(): Promise<PdfJsLib> {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
    sc.onload = () => {
      if (!window.pdfjsLib) {
        reject(new Error("pdfjsLib no se cargó"));
        return;
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    sc.onerror = () => reject(new Error("No se pudo cargar pdf.js"));
    document.head.appendChild(sc);
  });
}

function canvasToJpeg(src: CanvasImageSource, sw: number, sh: number): { data: string; w: number; h: number } | null {
  const max = 2400;
  let r = Math.min(1, max / Math.max(sw, sh));
  for (let tries = 0; tries < 6; tries++) {
    const cv = document.createElement("canvas");
    cv.width = Math.round(sw * r);
    cv.height = Math.round(sh * r);
    const cx = cv.getContext("2d");
    if (!cx) return null;
    cx.fillStyle = "#fff";
    cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(src, 0, 0, cv.width, cv.height);
    let q = 0.78;
    let url = cv.toDataURL("image/jpeg", q);
    while (url.length > 950000 && q > 0.45) {
      q -= 0.1;
      url = cv.toDataURL("image/jpeg", q);
    }
    if (url.length <= 950000) return { data: url, w: cv.width, h: cv.height };
    r *= 0.8;
  }
  return null;
}

export async function procesarPlano(file: File): Promise<{ data: string; w: number; h: number } | null> {
  const esPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
  if (esPdf) {
    try {
      const lib = await cargarPdfJs();
      const buf = await file.arrayBuffer();
      const pdf = await lib.getDocument({ data: buf }).promise;
      const page = await pdf.getPage(1);
      const v1 = page.getViewport({ scale: 1 });
      const sc = 2400 / Math.max(v1.width, v1.height);
      const vp = page.getViewport({ scale: sc });
      const cv = document.createElement("canvas");
      cv.width = Math.round(vp.width);
      cv.height = Math.round(vp.height);
      const cx = cv.getContext("2d");
      if (!cx) return null;
      cx.fillStyle = "#fff";
      cx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: cx, viewport: vp }).promise;
      return canvasToJpeg(cv, cv.width, cv.height);
    } catch (err) {
      console.warn(err);
      return null;
    }
  }
  return new Promise((resolve) => {
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => resolve(canvasToJpeg(im, im.naturalWidth, im.naturalHeight));
      im.onerror = () => resolve(null);
      im.src = rd.result as string;
    };
    rd.onerror = () => resolve(null);
    rd.readAsDataURL(file);
  });
}
