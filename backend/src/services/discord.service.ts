import { config } from '../config.js';
import type { PublicSessionState } from './serializer.js';

/** Sous-ensemble de l'API des webhooks Discord utilisé ici. */
export interface AllowedMentions {
  parse: ('everyone' | 'roles' | 'users')[];
  roles?: string[];
}

export interface DiscordMessage {
  content: string;
  allowed_mentions: AllowedMentions;
  embeds: {
    title: string;
    url?: string;
    description?: string;
    color: number;
    fields: { name: string; value: string; inline?: boolean }[];
    footer: { text: string };
  }[];
}

/**
 * Interprète DISCORD_MENTION_CROUSTY / DISCORD_MENTION_TACOS :
 * `@everyone` / `@here`, un rôle (`<@&123…>` ou simplement son identifiant numérique), ou vide (aucune mention).
 * `allowed_mentions` est toujours explicite : rien d'autre (ex. un « @everyone » dans la description) ne peut notifier.
 */
export function parseMention(raw: string): { text: string; allowed: AllowedMentions } {
  const value = raw.trim();
  if (value === '@everyone' || value === '@here') return { text: value, allowed: { parse: ['everyone'] } };
  const role = /^(?:<@&)?(\d{5,25})>?$/.exec(value);
  if (role) return { text: `<@&${role[1]}>`, allowed: { parse: [], roles: [role[1]!] } };
  return { text: '', allowed: { parse: [] } };
}

/** Échappe le Markdown Discord dans un texte saisi par un utilisateur. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_~`|>])/g, '\\$1');
}

const OUTING_LABEL = { TACOS: 'Tacos', KEBAB: 'Kebab', BOTH: 'Tacos / Kebab' } as const;

export function buildSessionOpenedMessage(
  state: PublicSessionState,
  opts: { mention: string; publicUrl: string },
): DiscordMessage {
  const s = state.session;
  const ts = Math.floor(new Date(s.scheduledAt).getTime() / 1000);
  const link = opts.publicUrl ? `${opts.publicUrl}/session/${s.id}` : undefined;
  const { text: mention, allowed } = parseMention(opts.mention);
  const by = `**${escapeMarkdown(s.creatorName)}**`;
  const isCrousty = s.type === 'CROUSTY';
  const outing = OUTING_LABEL[s.foodChoice ?? 'BOTH'];

  const headline = isCrousty
    ? `🍗 ${by} lance une **commande Crousty groupée** pour <t:${ts}:t> (<t:${ts}:R>). Ajoute ta commande !`
    : `🌯 ${by} propose une **sortie ${outing}** <t:${ts}:R>. Qui vient ?`;

  return {
    content: `${mention ? `${mention} ` : ''}${headline}${link ? `\n${link}` : ''}`,
    allowed_mentions: allowed,
    embeds: [
      {
        title: isCrousty ? 'Commande Crousty' : `Sortie ${outing}`,
        ...(link && { url: link }),
        ...(s.description && { description: s.description }),
        color: isCrousty ? 0xf59e0b : 0xb91c1c,
        fields: [
          { name: isCrousty ? 'Commande prévue' : 'Rendez-vous', value: `<t:${ts}:F>`, inline: true },
          { name: 'Organisé par', value: escapeMarkdown(s.creatorName), inline: true },
        ],
        footer: { text: 'Crousty & Kebab' },
      },
    ],
  };
}

function discordTarget(type: PublicSessionState['session']['type']): { url: string; mention: string } {
  return type === 'CROUSTY'
    ? { url: config.DISCORD_WEBHOOK_CROUSTY, mention: config.DISCORD_MENTION_CROUSTY }
    : { url: config.DISCORD_WEBHOOK_TACOS, mention: config.DISCORD_MENTION_TACOS };
}

/**
 * Prévient le salon Discord correspondant qu'une session vient d'être ouverte.
 * N'échoue jamais : une erreur Discord ne doit pas empêcher la création de la session.
 */
export async function notifySessionOpened(state: PublicSessionState): Promise<void> {
  const { url, mention } = discordTarget(state.session.type);
  if (!url) return;
  const body = buildSessionOpenedMessage(state, { mention, publicUrl: config.PUBLIC_URL });
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    // L'URL du webhook est un secret : on ne la journalise jamais.
    if (!res.ok) console.warn(`⚠️ Webhook Discord (${state.session.type}) : réponse HTTP ${res.status}`);
  } catch (e) {
    console.warn(`⚠️ Webhook Discord (${state.session.type}) injoignable :`, (e as Error).message);
  }
}
