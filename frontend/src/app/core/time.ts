/** "21:30" → "21h30" */
export function formatHour(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}h${m}`;
}

/** Heure par défaut proposée : dans 30 minutes, arrondie au quart d'heure supérieur. */
export function defaultTimeValue(now = new Date()): string {
  const d = new Date(now.getTime() + 30 * 60_000);
  const minutes = Math.ceil(d.getMinutes() / 15) * 15;
  d.setMinutes(minutes, 0, 0);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Convertit une valeur "HH:mm" en date absolue :
 * aujourd'hui, ou demain si l'heure est passée depuis plus d'une heure (ex. 23h50 → 00h30).
 */
export function timeValueToDate(value: string, now = new Date()): Date | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() < now.getTime() - 60 * 60_000) d.setDate(d.getDate() + 1);
  return d;
}
