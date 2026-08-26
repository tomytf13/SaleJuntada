const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? API_URL.replace(/\/api\/?$/, "");

/** Lo que toda juntada necesita, sin importar si ya tiene fecha. */
type CreateGatheringBase = {
  templateGatheringId?: string;
  title: string;
  organizerName: string;
  organizerAvatarUrl?: string;
  locationHint?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  durationMinutes?: number;
  dailyStartMinutes?: number;
  dailyEndMinutes?: number;
  slotStepMinutes?: number;
  timeZone?: string;
};

/**
 * El grupo ya sabe cuándo es. El backend deriva la ventana del día local de
 * `startsAt`, así que no hay que mandarla — y mandarla es un error, no una
 * preferencia: son dos modos distintos y el servidor rechaza la mezcla.
 */
export type FixedDateGatheringInput = CreateGatheringBase & {
  startsAt: string;
  windowStart?: never;
  windowEnd?: never;
};

/**
 * Todavía no saben cuándo. La ventana la elige quien crea: el backend no
 * inventa ninguna.
 */
export type FlexibleDateGatheringInput = CreateGatheringBase & {
  startsAt?: never;
  windowStart: string;
  windowEnd: string;
};

export type CreateGatheringInput =
  | FixedDateGatheringInput
  | FlexibleDateGatheringInput;

/**
 * Horario candidato. Lo calcula el backend en la zona horaria de la juntada,
 * así todo el grupo recibe los mismos instantes sin importar desde qué huso
 * abra el link.
 */
export type GatheringSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
};

/**
 * Estado de la juntada.
 *
 * `OPEN` = todavía busca fecha (hay encuesta de disponibilidad, no hay RSVP).
 * `CONFIRMED` = tiene fecha en `finalizedStart` (recién ahí existe el RSVP).
 *
 * `DRAFT` y `PROPOSED` se eliminaron en P1.1: nunca se escribieron ni se
 * leyeron en ninguna parte del producto.
 */
export type GatheringStatus = "OPEN" | "CONFIRMED" | "CANCELLED";

/** Respuesta a la invitación. Sólo aplica con fecha confirmada. */
export type RsvpStatus = "GOING" | "MAYBE" | "NOT_GOING";

/**
 * Recuento de asistencia. Sólo llega en la vista de participante: cómo
 * respondió el grupo es información del grupo, no del link.
 */
export type RsvpSummary = {
  going: number;
  maybe: number;
  notGoing: number;
  /** Participantes que todavía no respondieron. */
  pending: number;
  /** Gente que va a haber: suma de `1 + plusOnes` entre los GOING. */
  goingHeadcount: number;
};

export type Gathering = {
  id: string;
  slug: string;
  title: string;
  /**
   * Sólo llega en la vista de participante. Quien abre el link sin
   * credencial no recibe ninguna identidad del grupo, tampoco la de quien
   * organiza.
   */
  organizerName?: string;
  /**
   * `true` cuando la respuesta vino con un token válido. Con `false`,
   * `participants` llega vacío y las coordenadas en `null` aunque la
   * juntada tenga ubicación cargada.
   */
  isParticipant?: boolean;
  viewerParticipantId?: string | null;
  participantCount?: number;
  /** Sólo en la vista de participante. */
  rsvpSummary?: RsvpSummary;
  locationHint?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  windowStart: string;
  windowEnd: string;
  durationMinutes: number;
  dailyStartMinutes?: number;
  dailyEndMinutes?: number;
  slotStepMinutes?: number;
  timeZone?: string;
  slots?: GatheringSlot[];
  status: GatheringStatus;
  finalizedStart?: string | null;
  finalizedEnd?: string | null;
  finalizedLocation?: string | null;
  participants: Participant[];
};

export type Participant = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isOrganizer: boolean;
  dietaryPreferences?: DietaryPreference[];
  mealArrangement?: MealArrangement | null;
  responseToken?: string;
  /**
   * `null` significa dos cosas según la juntada: si no tiene fecha
   * (`finalizedStart === null`), el RSVP no aplica; si la tiene, esta
   * persona todavía no respondió.
   */
  rsvpStatus?: RsvpStatus | null;
  plusOnes?: number;
  rsvpAt?: string | null;
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

export type UpdateGatheringInput = {
  title: string;
  locationHint: string;
  windowStart: string;
  windowEnd: string;
  durationMinutes: number;
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  slotStepMinutes: number;
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
  status: GatheringStatus;
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

/** Error de la API que conserva el status HTTP para distinguir casos puntuales. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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
    throw new ApiError(
      detail ?? "No pudimos comunicarnos con Sale Juntada. Probá nuevamente.",
      response.status,
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

  deleteMyGathering(gatheringId: string, accessToken: string) {
    return request<{ id: string }>(`/users/me/gatherings/${gatheringId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  /**
   * Trae la juntada. Con `participantToken` el backend responde la vista
   * completa (disponibilidad del grupo, coordenadas exactas); sin token,
   * sólo lo necesario para decidir sumarse.
   */
  getBySlug(slug: string, participantToken?: string) {
    return request<Gathering>(`/gatherings/${slug}`, {
      headers: participantToken
        ? { "x-participant-token": participantToken }
        : undefined,
    });
  },

  addParticipant(
    gatheringId: string,
    name: string,
    avatarUrl?: string,
    allowDuplicateName?: boolean,
  ) {
    return request<Participant>(`/gatherings/${gatheringId}/participants`, {
      method: "POST",
      body: JSON.stringify({ name, avatarUrl, allowDuplicateName }),
    });
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

  /**
   * Responde la invitación.
   *
   * Sólo funciona con la juntada ya confirmada: si todavía no tiene fecha,
   * el backend devuelve 409. Es idempotente, así que reintentar es seguro y
   * no necesita clave de idempotencia.
   */
  setRsvp(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    input: { status: RsvpStatus; plusOnes?: number },
  ) {
    return request<{
      participantId: string;
      participantName: string;
      rsvpStatus: RsvpStatus;
      plusOnes: number;
      rsvpAt: string;
      rsvpSummary: RsvpSummary;
    }>(`/gatherings/${gatheringId}/participants/${participantId}/rsvp`, {
      method: "PUT",
      headers: { "x-participant-token": participantToken },
      body: JSON.stringify(input),
    });
  },

  getMatches(gatheringId: string, participantToken: string) {
    return request<Match[]>(`/gatherings/${gatheringId}/matches`, {
      headers: { "x-participant-token": participantToken },
    });
  },

  finalizeGathering(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    input: { startsAt: string; endsAt: string; location?: string },
  ) {
    return request<Gathering>(
      `/gatherings/${gatheringId}/participants/${participantId}/finalization`,
      {
        method: "PUT",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify(input),
      },
    );
  },

  updateGathering(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    input: UpdateGatheringInput,
  ) {
    return request<Gathering>(
      `/gatherings/${gatheringId}/participants/${participantId}/settings`,
      {
        method: "PATCH",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify(input),
      },
    );
  },

  cancelGathering(
    gatheringId: string,
    participantId: string,
    participantToken: string,
  ) {
    return request<Gathering>(
      `/gatherings/${gatheringId}/participants/${participantId}/settings`,
      {
        method: "DELETE",
        headers: { "x-participant-token": participantToken },
      },
    );
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

  getPurchasePlan(gatheringId: string, participantToken: string) {
    return request<PurchasePlan>(`/gatherings/${gatheringId}/purchase`, {
      headers: { "x-participant-token": participantToken },
    });
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

  /**
   * Carga un gasto.
   *
   * `idempotencyKey` identifica el **intento lógico**, no la llamada: quien
   * reintenta el mismo gasto tiene que mandar la misma clave para que el
   * backend devuelva el gasto ya creado en vez de duplicarlo. Un gasto
   * nuevo siempre lleva una clave nueva.
   */
  addExpense(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    idempotencyKey: string,
    input: { description: string; amountCents: number },
  ) {
    return request<Expense>(
      `/gatherings/${gatheringId}/participants/${participantId}/expenses`,
      {
        method: "POST",
        headers: {
          "x-participant-token": participantToken,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(input),
      },
    );
  },

  updateExpense(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    expenseId: string,
    input: { description: string; amountCents: number },
  ) {
    return request<Expense>(
      `/gatherings/${gatheringId}/participants/${participantId}/expenses/${expenseId}`,
      {
        method: "PATCH",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify(input),
      },
    );
  },

  deleteExpense(
    gatheringId: string,
    participantId: string,
    participantToken: string,
    expenseId: string,
  ) {
    return request<{ id: string }>(
      `/gatherings/${gatheringId}/participants/${participantId}/expenses/${expenseId}`,
      {
        method: "DELETE",
        headers: { "x-participant-token": participantToken },
      },
    );
  },

  getExpenseSettlement(gatheringId: string, participantToken: string) {
    return request<ExpenseSettlement>(
      `/gatherings/${gatheringId}/expenses/settlement`,
      { headers: { "x-participant-token": participantToken } },
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
