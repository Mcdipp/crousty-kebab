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

/** Date locale au format "YYYY-MM-DD" (valeur d'un <input type="date">). */
export function dateValue(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Jour situé `offset` jours après `now`, au format "YYYY-MM-DD". */
export function dayValue(offset: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  return dateValue(d);
}

/** Combine "YYYY-MM-DD" et "HH:mm" en date locale. */
export function dateTimeToDate(date: string, time: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dm || !tm) return null;
  const d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]), 0, 0);
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(dm[3]) ? null : d;
}

/** Jour relatif lisible : "aujourd’hui", "demain", "hier" ou "jeudi 19 novembre". */
export function formatDay(iso: string | Date, now = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const diff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return 'aujourd’hui';
  if (diff === 1) return 'demain';
  if (diff === -1) return 'hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "demain à 12h00", "aujourd’hui à 19h30", "jeudi 19 novembre à 12h00". */
export function formatWhen(iso: string | Date, now = new Date()): string {
  return `${formatDay(iso, now)} à ${formatHour(iso)}`;
}
