/**
 * Fechas sin hora (DATE de MySQL: nacimiento, licencias, verificaciones).
 * new Date('YYYY-MM-DD') es medianoche UTC y en México (UTC-6) cae en el día
 * anterior; toISOString() hace la conversión inversa. Estas dos funciones
 * trabajan siempre en hora local para que el día no se mueva.
 */
export function fechaLocal(valor: unknown): Date | null {
  if (!valor) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function ymdLocal(fecha: Date | null | undefined): string | null {
  if (!fecha) return null;
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
