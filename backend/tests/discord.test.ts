import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config.js';
import { prisma } from '../src/db.js';
import { buildSessionOpenedMessage, escapeMarkdown, parseMention } from '../src/services/discord.service.js';
import type { PublicSessionState } from '../src/services/serializer.js';
import { createCrousty, createTacos, resetDb } from './helpers.js';

const CROUSTY_HOOK = 'https://discord.com/api/webhooks/111/crousty-token';
const TACOS_HOOK = 'https://discord.com/api/webhooks/222/tacos-token';

const state = (over: Partial<PublicSessionState['session']> = {}): PublicSessionState => ({
  revision: 1,
  session: {
    id: '6f1c2a3b-0000-4000-8000-000000000001',
    type: 'TACOS_KEBAB',
    foodChoice: 'TACOS',
    scheduledAt: '2026-11-17T11:00:00.000Z',
    description: null,
    status: 'OPEN',
    creatorName: 'Inès',
    createdAt: '2026-11-16T09:00:00.000Z',
    closedAt: null,
    ...over,
  },
  participants: [],
  orders: [],
  participations: [],
});

describe('Message Discord', () => {
  it('interprète la mention configurée', () => {
    expect(parseMention('@everyone')).toEqual({ text: '@everyone', allowed: { parse: ['everyone'] } });
    expect(parseMention('@here')).toEqual({ text: '@here', allowed: { parse: ['everyone'] } });
    expect(parseMention('123456789012345678')).toEqual({
      text: '<@&123456789012345678>',
      allowed: { parse: [], roles: ['123456789012345678'] },
    });
    expect(parseMention('<@&123456789012345678>').text).toBe('<@&123456789012345678>');
    expect(parseMention('')).toEqual({ text: '', allowed: { parse: [] } });
    expect(parseMention('n’importe quoi')).toEqual({ text: '', allowed: { parse: [] } });
  });

  it('annonce une sortie avec mention, horodatage Discord et lien', () => {
    const msg = buildSessionOpenedMessage(state(), { mention: '@everyone', publicUrl: 'https://crousty.example.fr' });
    const ts = Date.parse('2026-11-17T11:00:00.000Z') / 1000;
    expect(msg.content).toBe(
      `@everyone 🌯 **Inès** propose une **sortie Tacos** <t:${ts}:R>. Qui vient ?\n` +
        'https://crousty.example.fr/session/6f1c2a3b-0000-4000-8000-000000000001',
    );
    expect(msg.allowed_mentions).toEqual({ parse: ['everyone'] });
    expect(msg.embeds[0]).toMatchObject({
      title: 'Sortie Tacos',
      url: 'https://crousty.example.fr/session/6f1c2a3b-0000-4000-8000-000000000001',
      fields: [{ name: 'Rendez-vous', value: `<t:${ts}:F>` }, { name: 'Organisé par', value: 'Inès' }],
    });
  });

  it('annonce une commande Crousty, sans lien si PUBLIC_URL est vide', () => {
    const msg = buildSessionOpenedMessage(state({ type: 'CROUSTY', foodChoice: null, description: 'Pause déj' }), {
      mention: '',
      publicUrl: '',
    });
    expect(msg.content).toMatch(/^🍗 \*\*Inès\*\* lance une \*\*commande Crousty groupée\*\*/);
    expect(msg.content).not.toContain('http');
    expect(msg.embeds[0]).toMatchObject({ title: 'Commande Crousty', description: 'Pause déj' });
    expect(msg.embeds[0]).not.toHaveProperty('url');
    // Sans mention configurée, personne ne peut être notifié (même via la description).
    expect(msg.allowed_mentions).toEqual({ parse: [] });
  });

  it('échappe le Markdown des noms', () => {
    expect(escapeMarkdown('jean_luc*')).toBe('jean\\_luc\\*');
  });
});

describe('Envoi du webhook à l’ouverture d’une session', () => {
  const saved = { ...config };
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await resetDb();
    config.DISCORD_WEBHOOK_CROUSTY = CROUSTY_HOOK;
    config.DISCORD_WEBHOOK_TACOS = '';
    config.DISCORD_MENTION_CROUSTY = '@here';
    config.DISCORD_MENTION_TACOS = '123456789012345678';
    config.PUBLIC_URL = 'https://crousty.example.fr';
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
  });

  afterEach(() => {
    Object.assign(config, saved);
    vi.restoreAllMocks();
  });

  afterAll(() => prisma.$disconnect());

  it('poste dans le salon du type de session, et seulement s’il est configuré', async () => {
    const s = await createCrousty('Thomas');
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(CROUSTY_HOOK);
    const body = JSON.parse(init.body as string);
    expect(body.content).toMatch(/^@here 🍗 \*\*Thomas\*\*/);
    expect(body.content).toContain(`https://crousty.example.fr/session/${s.state.session.id}`);

    // Pas de webhook Tacos configuré : aucun envoi.
    await createTacos();
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    config.DISCORD_WEBHOOK_TACOS = TACOS_HOOK;
    await createTacos('KEBAB', 'Yanis');
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(fetchSpy.mock.calls[1]![0]).toBe(TACOS_HOOK);
    // Chaque salon a sa propre mention.
    const tacosBody = JSON.parse((fetchSpy.mock.calls[1]![1] as RequestInit).body as string);
    expect(tacosBody.content).toMatch(/^<@&123456789012345678> 🌯/);
    expect(tacosBody.allowed_mentions).toEqual({ parse: [], roles: ['123456789012345678'] });
  });

  it('crée quand même la session si Discord est injoignable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    const s = await createCrousty();
    expect(s.state.session.status).toBe('OPEN');
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(String(warn.mock.calls[0]![0])).not.toContain('crousty-token');
  });
});
