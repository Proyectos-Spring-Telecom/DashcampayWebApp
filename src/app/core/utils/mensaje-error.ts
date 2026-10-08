/**
 * Texto legible de un error HTTP para mostrar en un aviso. Antes las pantallas
 * hacían String(error) y el usuario veía "[object Object]".
 * Cubre: string, HttpErrorResponse con { message: string | string[] }, cuerpo
 * de texto plano y Error.
 */
export function mensajeDeError(error: unknown, fallback = 'Ocurrió un error.'): string {
  if (error == null) return fallback;
  if (typeof error === 'string') return error || fallback;
  const e = error as { error?: unknown; message?: unknown };
  const cuerpo = e.error;
  if (typeof cuerpo === 'string' && cuerpo.trim()) return cuerpo;
  if (cuerpo && typeof cuerpo === 'object') {
    const m = (cuerpo as { message?: unknown }).message;
    if (Array.isArray(m) && m.length) return m.map(String).join('<br>');
    if (typeof m === 'string' && m.trim()) return m;
  }
  if (typeof e.message === 'string' && e.message.trim() && !e.message.startsWith('Http failure')) {
    return e.message;
  }
  return fallback;
}
