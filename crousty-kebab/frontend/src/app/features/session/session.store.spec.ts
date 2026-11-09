import type { SessionState } from '../../core/models';
import { computeCroustyStats, computeTacosStats } from './session.store';

const base = (): SessionState => ({
  revision: 1,
  session: {
    id: 's1', code: '0554', type: 'CROUSTY', foodChoice: null, scheduledAt: new Date().toISOString(),
    description: null, status: 'OPEN', creatorName: 'Thomas', createdAt: '', closedAt: null,
  },
  participants: [
    { id: 'p1', name: 'Thomas', isCreator: true, joinedAt: '' },
    { id: 'p2', name: 'Lucas', isCreator: false, joinedAt: '' },
    { id: 'p3', name: 'Mehdi', isCreator: false, joinedAt: '' },
  ],
  orders: [],
  participations: [],
});

const order = (id: string, participantId: string, targetName: string, productType: any, quantity: number) => ({
  id, participantId, targetName, productType, quantity, notes: null, createdAt: '', updatedAt: '',
});

describe('computeCroustyStats', () => {
  it('compte le total, les types et regroupe par personne', () => {
    const s = base();
    s.orders = [
      order('o1', 'p1', 'Thomas', 'PIQUANT', 1),
      order('o2', 'p1', 'Thomas', 'NATURE', 1),
      order('o3', 'p2', 'Lucas', 'SUCRE', 2),
      order('o4', 'p2', 'mehdi', 'SUCRE_PIQUANT', 1),
      order('o5', 'p3', 'Mehdi', 'SUCRE_PIQUANT', 1),
    ];
    const st = computeCroustyStats(s);
    expect(st.total).toBe(6);
    expect(st.byType.find((t) => t.id === 'SUCRE_PIQUANT')!.count).toBe(2);
    expect(st.byType.find((t) => t.id === 'SUCRE')!.count).toBe(2);
    expect(st.groups.map((g) => g.name)).toEqual(['Thomas', 'Lucas', 'mehdi']);
    expect(st.groups[0]!.total).toBe(2);
    expect(st.eaters).toBe(3);
  });

  it('gère un état vide', () => {
    expect(computeCroustyStats(null).total).toBe(0);
  });
});

describe('computeTacosStats', () => {
  it('liste qui vient, compte tacos / kebab et les non-répondants', () => {
    const s = base();
    s.participations = [
      { id: 'a', participantId: 'p1', choice: 'TACOS', notes: null, createdAt: '', updatedAt: '' },
      { id: 'b', participantId: 'p2', choice: 'KEBAB', notes: 'sauce blanche', createdAt: '', updatedAt: '' },
    ];
    const st = computeTacosStats(s);
    expect(st.total).toBe(2);
    expect(st.tacos).toBe(1);
    expect(st.kebab).toBe(1);
    expect(st.going.map((g) => g.name)).toEqual(['Thomas', 'Lucas']);
    expect(st.pending.map((p) => p.name)).toEqual(['Mehdi']);
  });
});
