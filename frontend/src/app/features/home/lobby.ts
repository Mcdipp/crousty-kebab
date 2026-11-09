import type { SessionSummary } from '../../core/models';

/** Ouvertes d'abord (heure prévue la plus proche), puis clôturées (les plus récentes d'abord). */
export function sortSessions(list: SessionSummary[]): SessionSummary[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'OPEN' ? -1 : 1;
    if (a.status === 'OPEN') return a.scheduledAt.localeCompare(b.scheduledAt);
    return (b.closedAt ?? '').localeCompare(a.closedAt ?? '');
  });
}

/** Insère ou remplace une session, en ignorant une version plus ancienne reçue en retard. */
export function upsertSession(list: SessionSummary[], s: SessionSummary): SessionSummary[] {
  const i = list.findIndex((x) => x.id === s.id);
  if (i === -1) return [...list, s];
  if (list[i]!.revision > s.revision) return list;
  const copy = [...list];
  copy[i] = s;
  return copy;
}
