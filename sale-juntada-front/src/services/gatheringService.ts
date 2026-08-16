const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? API_URL.replace(/\/api\/?$/, "");

export type CreateGatheringInput = {
  templateGatheringId?: string;
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
  dietaryPreferences?: DietaryPreference[];
  mealArrangement?: MealArrangement | null;
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

export type PaymentDetails = {
  paymentAlias: string | null;
  recipients: Array<{
    participantId: string;
    name: string;
    paymentAlias: string | null;
  }>;
};

export type DietaryPreference = "CELIAC" | "VEGAN" | "VEGETARIAN";
export type MealArrangement = "SELF_MANAGED" | "GROUP_MENU";

export type GatheringHistoryItem = {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "OPEN" | "PROPOSED" | "CONFIRMED" | "CANCELLED";
  organizerName: string;
  locationHint?: string | null;
  finalizedLocation?: string | null;
  finalizedStart?: string | null;
  windowStart: string;
  windowEnd: string;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  participant: {
    id: string;
    name: string;
    responseToken: string;
    isOrganizer: boolean;
  };
};

export type PurchaseItem = {
  key: string;
  label: string;
  unit: string;
  quantity: number;
  suggestedQuantity: number;
  category: "food" | "drinks" | "other" | "alcohol";
  position: number;
  assignedTo: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
  assignedAt: string | null;
  isReady: boolean;
  contributions: PurchaseContribution[];
};

export type PurchaseContribution = {
  id: string;
  catalogProductId?: string | null;
  catalogPresentationId?: string | null;
  description: string;
  quantity: number;
  unit: string;
  note: string | null;
  isReady: boolean;
  createdAt: string;
  updatedAt: string;
  participant: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
};

export type CatalogPresentation = {
  id: string;
  key: string;
  label: string;
  unit: string;
};

export type CatalogProduct = {
  id: string;
  key: string;
  categoryKey: string;
  name: string;
  brand: string | null;
  description: string | null;
  visualKey: string;
  accentColor: string;
  tags: string[];
  isAlcohol: boolean;
  presentations: CatalogPresentation[];
};

export type PurchaseCatalog = {
  version: number;
  products: CatalogProduct[];
};

export type PurchaseResponsibilityAction =
  "claim" | "release" | "ready" | "pending";

export type PurchasePlan = {
  id: string | null;
  persisted: boolean;
  includeAlcohol: boolean;
  ageConfirmed: boolean;
  participantCount: number;
  participantBaseline: number;
  updatedAt: string | null;
  items: PurchaseItem[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  init?.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("La conexión tardó demasiado. Probá nuevamente.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    init?.signal?.removeEventListener("abort", abortFromCaller);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
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

let purchaseCatalogRequest: Promise<PurchaseCatalog> | null = null;

export const gatheringService = {
  searchLocations(query: string) {
    return request<LocationSearchResult[]>(
      `/locations/search?q=${encodeURIComponent(query)}`,
    );
  },

  create(input: CreateGatheringInput, accessToken?: string | null) {
    return request<Gathering>("/gatherings", {
      method: "POST",
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
      body: JSON.stringify(input),
    });
  },

  getMyGatherings(accessToken: string) {
    return request<GatheringHistoryItem[]>("/users/me/gatherings", {
      headers: { Authorization: `Bearer ${accessToken}` },
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

  updateDietaryProfile(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    input: {
      dietaryPreferences: DietaryPreference[];
      mealArrangement: MealArrangement | null;
    },
  ) {
    return request<Participant>(
      `/gatherings/${gatheringId}/participants/${participantId}/dietary-profile`,
      {
        method: "PUT",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify(input),
      },
    );
  },

  linkAuthenticatedParticipant(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    accessToken: string,
  ) {
    return request<Participant>(
      `/gatherings/${gatheringId}/participants/${participantId}/auth-link`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-participant-token": participantToken,
        },
      },
    );
  },

  getPurchasePlan(gatheringId: string) {
    return request<PurchasePlan>(`/gatherings/${gatheringId}/purchase`);
  },

  getPurchaseCatalog() {
    purchaseCatalogRequest ??= request<PurchaseCatalog>(
      "/gatherings/catalog/purchase",
    ).catch((error) => {
      purchaseCatalogRequest = null;
      throw error;
    });
    return purchaseCatalogRequest;
  },

  updatePurchasePlan(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    input: Pick<PurchasePlan, "includeAlcohol" | "ageConfirmed"> & {
      items: Array<Pick<PurchaseItem, "key" | "quantity">>;
    },
  ) {
    return request<PurchasePlan>(
      `/gatherings/${gatheringId}/participants/${participantId}/purchase`,
      {
        method: "PUT",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify(input),
      },
    );
  },

  updatePurchaseResponsibility(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    itemKey: string,
    action: PurchaseResponsibilityAction,
    adultConfirmed = false,
  ) {
    return request<PurchasePlan>(
      `/gatherings/${gatheringId}/participants/${participantId}/purchase/items/${encodeURIComponent(itemKey)}/responsibility`,
      {
        method: "PUT",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify({ action, adultConfirmed }),
      },
    );
  },

  upsertPurchaseContribution(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    itemKey: string,
    input: {
      description?: string;
      catalogProductId?: string;
      catalogPresentationId?: string;
      quantity: number;
      unit?: string;
      note?: string;
      adultConfirmed?: boolean;
    },
  ) {
    return request<PurchasePlan>(
      `/gatherings/${gatheringId}/participants/${participantId}/purchase/items/${encodeURIComponent(itemKey)}/contribution`,
      {
        method: "PUT",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify(input),
      },
    );
  },

  updatePurchaseContributionStatus(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    contributionId: string,
    isReady: boolean,
  ) {
    return request<PurchasePlan>(
      `/gatherings/${gatheringId}/participants/${participantId}/purchase/contributions/${contributionId}/status`,
      {
        method: "PATCH",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify({ isReady }),
      },
    );
  },

  deletePurchaseContribution(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    contributionId: string,
  ) {
    return request<PurchasePlan>(
      `/gatherings/${gatheringId}/participants/${participantId}/purchase/contributions/${contributionId}`,
      {
        method: "DELETE",
        headers: { "x-participant-token": participantToken },
      },
    );
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

  getPaymentDetails(
    gatheringId: string,
    participantId: string,
    participantToken: string,
  ) {
    return request<PaymentDetails>(
      `/gatherings/${gatheringId}/participants/${participantId}/payment-details`,
      { headers: { "x-participant-token": participantToken } },
    );
  },

  updatePaymentAlias(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    paymentAlias: string,
    accessToken?: string | null,
  ) {
    return request<{ paymentAlias: string | null }>(
      `/gatherings/${gatheringId}/participants/${participantId}/payment-alias`,
      {
        method: "PUT",
        headers: {
          "x-participant-token": participantToken,
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined),
        },
        body: JSON.stringify({ paymentAlias }),
      },
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
