/** Solo https de S3 o del propio dominio. Rechaza javascript:, data: y hosts ajenos. */
export function allowedDocumentUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value || value.length > 8000) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;

  const host = parsed.hostname.toLowerCase();
  const permitido =
    host === 'amazonaws.com' ||
    host.endsWith('.amazonaws.com') ||
    host === 'dashcampay.com' ||
    host.endsWith('.dashcampay.com');

  return permitido ? parsed.toString() : null;
}
