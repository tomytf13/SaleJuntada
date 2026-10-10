import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Gathering } from "../services/gatheringService";
import { ApiError } from "../services/gatheringService";
import GatheringPage from "./GatheringPage";

const auth = vi.hoisted(() => ({
  value: {
    configured: true,
    isLoading: false,
    initializationError: null as string | null,
    user: null as null | {
      id?: string;
      email?: string;
      user_metadata: Record<string, unknown>;
    },
    accessToken: null as string | null,
    signInWithGoogle: vi.fn(),
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
  },
}));

const service = vi.hoisted(() => ({
  getBySlug: vi.fn(),
  addParticipant: vi.fn(),
  addAuthenticatedParticipant: vi.fn(),
  linkAuthenticatedParticipant: vi.fn().mockResolvedValue({}),
  setRsvp: vi.fn(),
  getMatches: vi.fn().mockResolvedValue([]),
  getExpenseSettlement: vi.fn().mockResolvedValue(null),
  getPaymentDetails: vi.fn().mockResolvedValue(null),
  getChecklist: vi.fn().mockResolvedValue([]),
  updateDietaryProfile: vi.fn(),
}));

const live = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => void>(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connections: vi.fn(),
}));
vi.mock("socket.io-client", () => ({
  io: () => { live.connections(); return ({
    on: (name: string, handler: (...args: unknown[]) => void) => {
      live.handlers.set(name, handler);
    },
    connect: vi.fn(),
    emit: live.emit,
    disconnect: live.disconnect,
  }); },
}));
vi.mock("../components/MobileExperience", () => ({
  MobileBottomNav: () => null,
  PurchasePlanner: () => null,
}));

// `virtual:pwa-register/react` sólo existe cuando vite-plugin-pwa procesa el
// build; vitest.config.ts no carga ese plugin, así que PwaStatus (sin
// relación con el routing de P1.3) se reemplaza por un stub.
vi.mock("../components/PwaStatus", () => ({ PwaStatus: () => null }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("../services/gatheringService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/gatheringService")>();
  return { ...actual, gatheringService: service };
});

const baseGathering: Gathering = {
  id: "gathering-1",
  slug: "asado-cancelado",
  title: "Asado cancelado",
  windowStart: "2026-08-20T22:00:00.000Z",
  windowEnd: "2026-08-23T05:00:00.000Z",
  durationMinutes: 180,
  status: "OPEN",
  participants: [],
  participantCount: 0,
  isParticipant: false,
};

beforeEach(() => {
  auth.value.user = { id: "account-1", email: "sofi@example.com", user_metadata: {} };
  auth.value.accessToken = "account-token";
  service.getBySlug.mockReset();
  localStorage.clear();
  window.scrollTo = vi.fn();
  live.connections.mockClear();
  live.disconnect.mockClear();
  live.handlers.clear();
  live.emit.mockReset();
  service.setRsvp.mockReset();
  service.addParticipant.mockReset();
  service.addAuthenticatedParticipant.mockReset();
  service.linkAuthenticatedParticipant.mockReset().mockImplementation((_g, id, token) => Promise.resolve({ id, responseToken: token }));
  service.getMatches.mockResolvedValue([]);
  service.getExpenseSettlement.mockResolvedValue(null);
  service.getPaymentDetails.mockResolvedValue(null);
  service.getChecklist.mockReset().mockResolvedValue([]);
  service.updateDietaryProfile.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderGatheringPage(slug: string, view = "") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/j/${slug}${view ? `/${view}` : ""}`]}>
        <Routes>
          <Route path="/j/:slug/*" element={<GatheringPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("GatheringPage", () => {
  it("sin login ignora el acceso antiguo y pide una cuenta antes de aceptar", async () => {
    auth.value.user = null;
    auth.value.accessToken = null;
    saveSession();
    service.getBySlug.mockResolvedValue({ ...privateGathering, participants: [], isParticipant: false });
    renderGatheringPage("asado-hoy", "invitados");
    await userEvent.click(await screen.findByRole("button", { name: "Ingresar para aceptar la invitación" }));
    expect(screen.getByRole("button", { name: /Google/ })).toBeEnabled();
    expect(service.getBySlug).toHaveBeenCalledWith("asado-hoy", undefined);
    expect(service.linkAuthenticatedParticipant).not.toHaveBeenCalled();
    expect(service.addAuthenticatedParticipant).not.toHaveBeenCalled();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(live.connections).not.toHaveBeenCalled();
  });

  it("muestra un mensaje específico cuando el slug no existe, sin modal de join ni demo", async () => {
    service.getBySlug.mockRejectedValue(new ApiError("No encontrada", 404));

    renderGatheringPage("no-existe");

    expect(
      await screen.findByText(
        /esta juntada no existe o el link ya no es válido/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/¿cómo te llamás\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Asado con los pibes")).not.toBeInTheDocument();
  });

  it("sigue funcionando para una juntada CANCELLED y no muestra la disponibilidad", async () => {
    service.getBySlug.mockResolvedValue({
      ...baseGathering,
      status: "CANCELLED",
      finalizedStart: "2026-08-22T00:00:00.000Z",
      finalizedEnd: null,
      locationHint: "Yerba Buena",
    });

    renderGatheringPage("asado-cancelado");

    expect(
      (await screen.findAllByText("Asado cancelado")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/esta juntada fue cancelada/i)).toBeInTheDocument();
    expect(screen.queryByText(/¿cuándo podés\?/i)).not.toBeInTheDocument();
  });

  it("usa el slug de la ruta, no un parseo manual de pathname", async () => {
    service.getBySlug.mockResolvedValue({ ...baseGathering });

    renderGatheringPage("asado-cancelado");

    await screen.findAllByText("Asado cancelado");
    expect(service.getBySlug).toHaveBeenCalledWith(
      "asado-cancelado",
      undefined,
    );
  });
});

const privateGathering: Gathering = {
  ...baseGathering,
  slug: "asado-hoy",
  title: "Asado de hoy",
  status: "CONFIRMED",
  finalizedStart: "2026-10-04T00:00:00.000Z",
  finalizedEnd: "2026-10-04T03:00:00.000Z",
  timeZone: "America/Argentina/Tucuman",
  locationHint: "Yerba Buena",
  isParticipant: true,
  participantCount: 2,
  participants: [
    {
      id: "me",
      name: "Sofi",
      isOrganizer: false,
      rsvpStatus: null,
      plusOnes: 0,
    },
    {
      id: "friend",
      name: "Tomy",
      isOrganizer: true,
      rsvpStatus: "GOING",
      plusOnes: 0,
    },
  ],
};

function saveSession() {
  localStorage.setItem(
    "sale-juntada:participant:asado-hoy",
    JSON.stringify({ participantId: "me", responseToken: "secret" }),
  );
}

describe("invitación y asistencia en vivo", () => {
  it("muestra el contexto antes de pedir el nombre, sin identidades ni respuestas públicas", async () => {
    service.getBySlug.mockResolvedValue({
      ...privateGathering,
      participants: [],
      isParticipant: false,
    });
    renderGatheringPage("asado-hoy");
    expect(
      await screen.findByRole("heading", { name: "Asado de hoy", level: 1 }),
    ).toBeVisible();
    expect(screen.getByText("📍 Yerba Buena")).toBeVisible();
    expect(screen.getByRole("button", { name: /Aceptar invitación/i })).toBeVisible();
    expect(screen.queryByLabelText("Tu nombre")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByText("Tomy")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Aceptar invitación/i }));
    expect(screen.getByLabelText("Tu nombre")).toBeVisible();
  });

  it("guarda el teléfono normalizado y recupera la participación de Google", async () => {
    auth.value.user = { email: "sofi@example.com", user_metadata: { full_name: "Sofi" } };
    auth.value.accessToken = "google-session";
    service.getBySlug.mockImplementation((_slug: string, token?: string) => Promise.resolve(
      token ? privateGathering : { ...privateGathering, participants: [], isParticipant: false },
    ));
    service.addAuthenticatedParticipant.mockResolvedValue({ ...privateGathering.participants[0], responseToken: "secret" });
    renderGatheringPage("asado-hoy");
    await userEvent.click(await screen.findByRole("button", { name: /Aceptar invitación/i }));
    expect(screen.getByLabelText("Tu nombre")).toHaveValue("Sofi");
    await userEvent.selectOptions(screen.getByLabelText("País", { exact: true }), "ES");
    await userEvent.type(screen.getByLabelText(/Número de teléfono/), "612 345 678");
    await userEvent.click(screen.getByRole("button", { name: "Entrar y responder" }));
    await waitFor(() => expect(service.addAuthenticatedParticipant).toHaveBeenCalledWith("gathering-1", "google-session", { name: "Sofi", contact: "+34612345678" }));
    expect(service.addParticipant).not.toHaveBeenCalled();
    await screen.findByRole("radiogroup", { name: "Tu asistencia" });
  });

  it("rechaza un número incompleto antes de enviarlo", async () => {
    service.getBySlug.mockResolvedValue({ ...privateGathering, participants: [], isParticipant: false });
    renderGatheringPage("asado-hoy");
    await userEvent.click(await screen.findByRole("button", { name: /Aceptar invitación/i }));
    await userEvent.clear(screen.getByLabelText("Tu nombre"));
    await userEvent.type(screen.getByLabelText("Tu nombre"), "Sofi");
    await userEvent.type(screen.getByLabelText(/Número de teléfono/), "123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar y responder" }));
    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent("código de área");
    expect(service.addParticipant).not.toHaveBeenCalled();
  });

  it("se suma con nombre y obtiene la vista privada antes de responder", async () => {
    service.getBySlug.mockImplementation((_slug: string, token?: string) =>
      Promise.resolve(
        token
          ? privateGathering
          : { ...privateGathering, participants: [], isParticipant: false },
      ),
    );
    service.addAuthenticatedParticipant.mockResolvedValue({
      ...privateGathering.participants[0],
      responseToken: "secret",
    });
    service.setRsvp.mockResolvedValue({});
    renderGatheringPage("asado-hoy");
    await userEvent.click(
      await screen.findByRole("button", { name: /Aceptar invitación/i }),
    );
    await userEvent.clear(screen.getByLabelText("Tu nombre"));
    await userEvent.type(screen.getByLabelText("Tu nombre"), "Sofi");
    expect(screen.getByLabelText("País", { exact: true })).toHaveValue("AR");
    await userEvent.type(screen.getByLabelText(/Número de teléfono/), "9 381 123 4567");
    await userEvent.click(
      screen.getByRole("button", { name: "Entrar y responder" }),
    );
    await screen.findByRole("radiogroup", { name: "Tu asistencia" });
    expect(service.getBySlug).toHaveBeenCalledWith("asado-hoy", "secret");
    expect(service.addAuthenticatedParticipant).toHaveBeenCalledWith("gathering-1", "account-token", { name: "Sofi", contact: "+5493811234567" });
    await userEvent.click(screen.getByRole("link", { name: /Invitados 1 van/ }));
    expect(screen.getByText("Tomy")).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "Voy" }));
    await waitFor(() =>
      expect(service.setRsvp).toHaveBeenCalledWith(
        "gathering-1",
        "me",
        "secret",
        { status: "GOING", plusOnes: 0 },
      ),
    );
  });

  it("refresca las respuestas y los acompañantes del otro invitado por socket", async () => {
    saveSession();
    let current = privateGathering;
    service.getBySlug.mockImplementation(() => Promise.resolve(current));
    renderGatheringPage("asado-hoy", "invitados");
    await screen.findByRole("radiogroup");
    current = {
      ...privateGathering,
      participants: privateGathering.participants.map((p) => ({
        ...p,
        rsvpStatus: "GOING",
        plusOnes: p.id === "friend" ? 2 : 0,
      })),
    };
    await act(async () => {
      live.handlers.get("rsvp:changed")?.({ participantId: "friend" });
    });
    expect(
      await screen.findByText("4 personas contando acompañantes"),
    ).toBeVisible();
    expect(service.getBySlug).toHaveBeenLastCalledWith("asado-hoy", "secret");
    expect(screen.getByText(/2 van · 0 no saben/)).toBeVisible();
  });

  it("recupera los cambios perdidos al reconectar a la sala autenticada", async () => {
    saveSession();
    service.getBySlug.mockResolvedValue(privateGathering);
    live.emit.mockImplementation(
      (
        name: string,
        _payload: unknown,
        callback?: (result: { joined: boolean }) => void,
      ) => {
        if (name === "gathering:join") callback?.({ joined: true });
      },
    );
    renderGatheringPage("asado-hoy");
    await screen.findByRole("radiogroup");
    const before = service.getBySlug.mock.calls.length;
    await act(async () => {
      live.handlers.get("connect")?.();
    });
    await waitFor(() =>
      expect(service.getBySlug.mock.calls.length).toBeGreaterThan(before),
    );
    expect(live.emit).toHaveBeenCalledWith(
      "gathering:join",
      {
        gatheringId: "gathering-1",
        participantId: "me",
        participantToken: "secret",
      },
      expect.any(Function),
    );
    expect(screen.getByText("En vivo")).toBeInTheDocument();
  });
});

describe("servicios con pantallas propias", () => {
  it("abre un servicio privado después de ingresar sin perder el destino", async () => {
    service.getBySlug.mockImplementation((_slug: string, token?: string) => Promise.resolve(token ? privateGathering : { ...privateGathering, participants: [], isParticipant: false }));
    service.addAuthenticatedParticipant.mockResolvedValue({ ...privateGathering.participants[0], responseToken: "secret" });
    renderGatheringPage("asado-hoy", "pendientes");
    await userEvent.click(await screen.findByRole("button", { name: /Aceptar invitación/i }));
    expect(screen.queryByText("Qué falta resolver")).not.toBeInTheDocument();
    expect(service.getChecklist).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText("Tu nombre"));
    await userEvent.type(screen.getByLabelText("Tu nombre"), "Sofi");
    await userEvent.click(screen.getByRole("button", { name: "Entrar y responder" }));
    expect(await screen.findByRole("heading", { name: "Qué falta resolver" })).toBeVisible();
    expect(screen.queryByText("Servicios de esta juntada")).not.toBeInTheDocument();
  });

  it("conserva el borrador y el socket al recorrer distintos módulos", async () => {
    saveSession();
    service.getBySlug.mockResolvedValue(privateGathering);
    renderGatheringPage("asado-hoy", "pendientes");
    await userEvent.type(await screen.findByLabelText("Agregar una necesidad"), "Un parlante grande");
    const connections = live.connections.mock.calls.length;
    const disconnects = live.disconnect.mock.calls.length;
    await userEvent.click(screen.getByRole("link", { name: "← Asado de hoy" }));
    expect(screen.queryByLabelText("Agregar una necesidad")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Pendientes y útiles 0 sin responsable/ }));
    expect(screen.getByLabelText("Agregar una necesidad")).toHaveValue("Un parlante grande");
    expect(live.connections).toHaveBeenCalledTimes(connections);
    expect(live.disconnect).toHaveBeenCalledTimes(disconnects);
  });

  it("refleja en Inicio cambios recibidos mientras se usa otro módulo", async () => {
    saveSession();
    let current = privateGathering;
    service.getBySlug.mockImplementation(() => Promise.resolve(current));
    renderGatheringPage("asado-hoy", "pendientes");
    await screen.findByLabelText("Agregar una necesidad");
    current = { ...privateGathering, participants: privateGathering.participants.map(p => ({ ...p, rsvpStatus: "GOING" })) };
    await act(async () => { live.handlers.get("rsvp:changed")?.(); });
    await userEvent.click(screen.getByRole("link", { name: "← Asado de hoy" }));
    expect(await screen.findByRole("link", { name: "Invitados 2 van · 0 sin responder" })).toBeVisible();
  });

  it("permite alimentación sin fecha y conserva la elección sin guardar al navegar", async () => {
    saveSession();
    service.getBySlug.mockResolvedValue({ ...privateGathering, status: "OPEN", finalizedStart: null });
    renderGatheringPage("asado-hoy", "alimentacion");
    await userEvent.click(await screen.findByRole("checkbox", { name: /Vegetariano/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Me ocupo yo/ }));
    await userEvent.click(screen.getByRole("link", { name: "← Asado de hoy" }));
    await userEvent.click(screen.getByRole("link", { name: /Alimentación 0 personas/ }));
    expect(screen.getByRole("checkbox", { name: /Vegetariano/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Me ocupo yo/ })).toHaveAttribute("aria-checked", "true");
    expect(service.updateDietaryProfile).not.toHaveBeenCalled();
    expect(screen.queryByText("Armemos la compra.")).not.toBeInTheDocument();
  });

  it("mantiene alimentación en lectura cuando la juntada está cancelada", async () => {
    saveSession();
    service.getBySlug.mockResolvedValue({ ...privateGathering, status: "CANCELLED" });
    renderGatheringPage("asado-hoy", "alimentacion");
    expect(await screen.findByRole("checkbox", { name: /Vegetariano/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar mi elección" })).toBeDisabled();
  });

  it("muestra un destino recuperable si el servicio no existe", async () => {
    saveSession();
    service.getBySlug.mockResolvedValue(privateGathering);
    renderGatheringPage("asado-hoy", "cuentas/no-existe");
    expect(await screen.findByRole("heading", { name: "Servicio no encontrado" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Volver a la juntada" })).toHaveAttribute("href", "/j/asado-hoy");
  });
});
