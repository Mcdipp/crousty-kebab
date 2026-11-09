import { config } from '../config.js';
import { prisma } from '../db.js';
import type { PublicSessionState } from './serializer.js';

export interface SessionSummary {
    id: string;
    code: string;
    type: 'CROUSTY' | 'TACOS_KEBAB';
    foodChoice: 'TACOS' | 'KEBAB' | 'BOTH' | null;
    scheduledAt: string;
    description: string | null;
    status: 'OPEN' | 'CLOSED';
    creatorName: string;
    createdAt: string;
    closedAt: string | null;
    participantCount: number;
    itemCount: number;
    revision: number;
}

export function summarize (state: PublicSessionState): SessionSummary{
    const s = state.session;
    return{
        id: s.id,
        code: s.code,
        type: s.type,
        foodChoice: s.foodChoice,
        scheduledAt: s.scheduledAt,
        description: s.description,
        status: s.status,
        creatorName: s.creatorName,
        createdAt: s.createdAt,
        closedAt: s.closedAt,
        participantCount: state.participants.length,
        itemCount:
            s.type === 'CROUSTY'
                ? state.orders.reduce((n, o) => n + o.quantity, 0)
                : state.participations.length,
        revision: state.revision,
    };
}

export function compareSummaries(a: SessionSummary, b: SessionSummary): number {
    if (a.status !== b.status) return a.status === 'OPEN' ? -1 : 1;
    if (a.status === 'OPEN') return a.scheduledAt.localeCompare(b.scheduledAt);
    return (b.closedAt ?? '').localeCompare(a.closedAt ?? '');
}

export async function listLobbySessions(): Promise<SessionSummary[]>{
    const now = new Date();
    const closedCutoff = new Date(now.getTime() - config.LOBBY_CLOSED_HOURS * 3_600_000);
    const rows = await prisma.session.findMany({
        where: {
            expiresAt: { gt: now },
            OR: [{ status: 'OPEN' }, { status: 'CLOSED', closedAt: { gte: closedCutoff } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
        select: {
            id: true,
            code: true,
            type: true,
            foodChoice: true,
            scheduledAt: true,
            description: true,
            status: true,
            creatorName: true,
            createdAt: true,
            closedAt: true,
            participants: { select: { id: true } },
            orders: { select: { quantity: true } },
            participations: { select: { id: true } },
        },
    });
    const revision = Date.now();
    return rows
        .map((r) => ({
            id: r.id,
            code: r.code,
            type: r.type,
            foodChoice: r.foodChoice,
            scheduledAt: r.scheduledAt.toISOString(),
            description: r.description,
            status: r.status,
            creatorName: r.creatorName,
            createdAt: r.createdAt.toISOString(),
            closedAt: r.closedAt?.toISOString() ?? null,
            participantCount: r.participants.length,
            itemCount: r.type === 'CROUSTY' ? r.orders.reduce((n, o) => n + o.quantity, 0) : r.participations.length,
            revision,
        }))
        .sort(compareSummaries);
}



