export type SessionType = 'CROUSTY' | 'TACOS_KEBAB';
export type SessionStatus = 'OPEN' | 'CLOSED';
export type FoodChoice = 'TACOS' | 'KEBAB' | 'BOTH';
export type ParticipationChoice = 'TACOS' | 'KEBAB';
export type CroustyProduct = 'NATURE' | 'PIQUANT' | 'SUCRE' | 'SUCRE_PIQUANT';

export interface SessionInfo {
  id: string;
  code: string;
  type: SessionType;
  foodChoice: FoodChoice | null;
  scheduledAt: string;
  description: string | null;
  status: SessionStatus;
  creatorName: string;
  createdAt: string;
  closedAt: string | null;
}

export interface Participant {
  id: string;
  name: string;
  isCreator: boolean;
  joinedAt: string;
}

export interface Order {
  id: string;
  participantId: string;
  targetName: string;
  productType: CroustyProduct;
  quantity: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Participation {
  id: string;
  participantId: string;
  choice: ParticipationChoice;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionState {
  revision: number;
  session: SessionInfo;
  participants: Participant[];
  orders: Order[];
  participations: Participation[];
}

export interface CreateSessionResponse {
  state: SessionState;
  participantId: string;
  participantToken: string;
  creatorToken: string;
}

export interface JoinSessionResponse {
  state: SessionState;
  participantId: string;
  participantToken: string;
}

export interface RealtimePayload {
  state: SessionState;
  actor: string | null;
  data?: unknown;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
