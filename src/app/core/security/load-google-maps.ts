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
