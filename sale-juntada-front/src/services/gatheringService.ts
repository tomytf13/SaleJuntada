const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  API_URL.replace(/\/api\/?$/, "");

export type CreateGatheringInput = {
  title: string;
  organizerName: string;
  organizerAvatarUrl?: string;
  locationHint?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  windowStart: string;
  windowEnd: string;
  durationMinutes?: number;
  dailyStartMinutes?: number;
  dailyEndMinutes?: number;
  slotStepMinutes?: number;
};

export type Gathering = {
  id: string;
  slug: string;
  title: string;
  organizerName: string;
  locationHint?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  windowStart: string;
  windowEnd: string;
  durationMinutes: number;
  dailyStartMinutes?: number;
  dailyEndMinutes?: number;
  slotStepMinutes?: number;
  participants: Participant[];
  proposals?: unknown[];
};

export type Participant = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isOrganizer: boolean;
  responseToken?: string;
  expensesReadyAt?: string | null;
  availabilities?: Availability[];
};

export type Availability = {
  id: string;
  startsAt: string;
  endsAt: string;
  kind: "AVAILABLE" | "MAYBE" | "UNAVAILABLE";
};

export type AvailabilityInput = {
  startsAt: string;
  endsAt: string;
  kind: Availability["kind"];
};

export type LocationSearchResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type Match = {
  startsAt: string;
  endsAt: string;
  available: number;
  maybe: number;
  total: number;
  missing: number;
  score: number;
  explanation: string;
  availableParticipantNames: string[];
  maybeParticipantNames: string[];
  missingParticipantNames: string[];
  pendingParticipantNames: string[];
  conflictParticipantNames: string[];
};

export type Expense = {
  id: string;
  description: string;
  amountCents: number;
  paidByParticipantId: string;
  paidBy: { id: string; name: string; avatarUrl?: string | null };
  createdAt: string;
};

export type ExpenseSettlement = {
  totalCents: number;
  participantCount: number;
  averageCents: number;
  expenseRound: number;
  allReady: boolean;
  readyParticipants: Array<{ participantId: string; name: string }>;
  pendingReadyParticipants: Array<{ participantId: string; name: string }>;
  expenses: Expense[];
  balances: Array<{
    participantId: string;
    name: string;
    paidCents: number;
    owedCents: number;
    balanceCents: number;
  }>;
  transfers: Array<{
    id: string;
    fromParticipantId: string;
    fromName: string;
    toParticipantId: string;
    toName: string;
    amountCents: number;
    settled: boolean;
  }>;
  completedTransfers: Array<{
    id: string;
    fromParticipantId: string;
    fromName: string;
    toParticipantId: string;
    toName: string;
    amountCents: number;
    confirmedAt: string;
  }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      message?: string | string[];
    } | null;
    const detail = Array.isArray(body?.message)
      ? body.message.join(". ")
      : body?.message;
    throw new Error(
      detail ?? "No pudimos comunicarnos con Sale Juntada. Probá nuevamente.",
    );
  }

  return response.json() as Promise<T>;
}

export const gatheringService = {
  searchLocations(query: string) {
    return request<LocationSearchResult[]>(
      `/locations/search?q=${encodeURIComponent(query)}`,
    );
  },

  create(input: CreateGatheringInput) {
    return request<Gathering>("/gatherings", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getBySlug(slug: string) {
    return request<Gathering>(`/gatherings/${slug}`);
  },

  addParticipant(gatheringId: string, name: string, avatarUrl?: string) {
    return request<Participant>(`/gatherings/${gatheringId}/participants`, {
      method: "POST",
      body: JSON.stringify({ name, avatarUrl }),
    });
  },

  addGoogleParticipant(gatheringId: string, credential: string) {
    return request<Participant>(
      `/gatherings/${gatheringId}/participants/google`,
      {
        method: "POST",
        body: JSON.stringify({ credential }),
      },
    );
  },

  setAvailability(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    slots: AvailabilityInput[],
  ) {
    return request<Participant>(
      `/gatherings/${gatheringId}/participants/${participantId}/availability`,
      {
        method: "PUT",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify({ slots }),
      },
    );
  },

  getMatches(gatheringId: string) {
    return request<Match[]>(`/gatherings/${gatheringId}/matches`);
  },

  addExpense(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    input: { description: string; amountCents: number },
  ) {
    return request<Expense>(
      `/gatherings/${gatheringId}/participants/${participantId}/expenses`,
      {
        method: "POST",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify(input),
      },
    );
  },

  getExpenseSettlement(gatheringId: string) {
    return request<ExpenseSettlement>(
      `/gatherings/${gatheringId}/expenses/settlement`,
    );
  },

  markExpensesReady(
    gatheringId: string,
    participantId: string,
    participantToken: string,
  ) {
    return request(
      `/gatherings/${gatheringId}/participants/${participantId}/expenses/ready`,
      {
        method: "POST",
        headers: { "x-participant-token": participantToken },
      },
    );
  },

  confirmTransfer(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    input: { toParticipantId: string; amountCents: number },
  ) {
    return request(
      `/gatherings/${gatheringId}/participants/${participantId}/transfers/confirm`,
      {
        method: "POST",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify(input),
      },
    );
  },
};
