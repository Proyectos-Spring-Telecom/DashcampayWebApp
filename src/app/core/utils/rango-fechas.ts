export const MAX_RANGO_DIAS = 92;

/** null si el rango es válido. Texto listo para mostrar si no. */
export function mensajeRangoFechas(
  inicio?: string | null,
  fin?: string | null,
): string | null {
  if (!inicio || !fin) return null;
  const from = Date.parse(`${String(inicio).slice(0, 10)}T00:00:00`);
  const to = Date.parse(`${String(fin).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
    return 'La fecha fin debe ser posterior o igual a la fecha inicio.';
  }
  const days = Math.floor((to - from) / 86_400_000) + 1;
  if (days > MAX_RANGO_DIAS) {
    return `El rango de fechas no puede exceder ${MAX_RANGO_DIAS} días.`;
  }
  return null;
}
