// Comprime la foto de una luminaria a un JPEG chico (máx 400px de lado,
// calidad 0.82) para guardarla directo como campo del documento en
// Firestore — igual que cgLoadImg en el original
// (/tmp/protectos-itelsa/index.html, líneas ~2792-2806). A esta escala el
// archivo resultante entra sin problema en un documento de Firestore, así
// que a diferencia del plano (Fase 3, colección aparte "gfiles") esto no
// necesita una colección propia.
export function comprimirImagen(file: File): Promise<{ img: string; iw: number; ih: number } | null> {
  return new Promise((resolve) => {
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const max = 400;
        const r = Math.min(1, max / Math.max(im.width, im.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(im.width * r);
        cv.height = Math.round(im.height * r);
        const cx = cv.getContext("2d");
        if (!cx) {
          resolve(null);
          return;
        }
        cx.fillStyle = "#fff";
        cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(im, 0, 0, cv.width, cv.height);
        resolve({ img: cv.toDataURL("image/jpeg", 0.82), iw: cv.width, ih: cv.height });
      };
      im.onerror = () => resolve(null);
      im.src = rd.result as string;
    };
    rd.onerror = () => resolve(null);
    rd.readAsDataURL(file);
  });
}
