const LIBRARIES = new Set(['marker', 'places', 'geometry']);

/**
 * La key solo vive en este módulo (pantallas de mapa), no en index.html.
 * En Google Cloud debe quedar restringida por referrer: el navegador siempre la ve.
 */
const GOOGLE_MAPS_API_KEY = 'AIzaSyDOlZGwePQfNGK5JPaRZjjIyj5OhCBezaE';

/** Arma la URL del script. Null si no hay key. */
export function googleMapsScriptUrl(libraries: string): string | null {
  const key = GOOGLE_MAPS_API_KEY.trim();
  if (!key) return null;
  const libs = libraries
    .split(',')
    .map((item) => item.trim())
    .filter((item) => LIBRARIES.has(item));
  const extra = libs.length ? `&libraries=${libs.join(',')}` : '';
  return `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=es&region=MX&loading=async${extra}`;
}

let cargando: Promise<void> | null = null;

/**
 * Carga el script de Maps una sola vez para toda la app (todas las librerías
 * permitidas) y resuelve cuando la API está lista, vía callback. Al quitar el
 * <script> de index.html, las pantallas que solo esperaban a window.google
 * quedaron sin mapa (monitoreo se cortaba a los 8 s; agregar-variante esperaba
 * para siempre).
 */
export function loadGoogleMaps(): Promise<void> {
  const w = window as any;
  if (w.google?.maps?.Map) return Promise.resolve();
  if (cargando) return cargando;
  cargando = new Promise<void>((resolve, reject) => {
    const src = googleMapsScriptUrl([...LIBRARIES].join(','));
    if (!src) {
      cargando = null;
      reject(new Error('No se pudo cargar Google Maps'));
      return;
    }
    const callback = '__dashcamMapsListo';
    w[callback] = () => {
      delete w[callback];
      resolve();
    };
    const script = document.createElement('script');
    script.src = `${src}&callback=${callback}`;
    script.async = true;
    script.onerror = () => {
      cargando = null;
      reject(new Error('No se pudo cargar Google Maps'));
    };
    document.head.appendChild(script);
  });
  return cargando;
}
