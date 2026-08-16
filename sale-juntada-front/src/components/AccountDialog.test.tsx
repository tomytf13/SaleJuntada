import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "../motion/MotionProvider";
import { AccountDialog } from "./AccountDialog";

const auth = vi.hoisted(() => ({
  value: {
    configured: true,
    isLoading: false,
    initializationError: null as string | null,
    user: null as null | {
      email?: string;
      user_metadata: Record<string, unknown>;
    },
    accessToken: null as string | null,
    signInWithGoogle: vi.fn<() => Promise<void>>(),
    signInWithEmail: vi.fn<(email: string) => Promise<void>>(),
    signOut: vi.fn<() => Promise<void>>(),
  },
}));

const services = vi.hoisted(() => ({
  getMyGatherings: vi.fn(),
  deleteMyGathering: vi.fn(),
}));

vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("../services/gatheringService", () => ({
  gatheringService: services,
}));

function renderDialog() {
  return render(
    <MotionProvider>
      <AccountDialog open onClose={vi.fn()} />
    </MotionProvider>,
  );
}

beforeEach(() => {
  auth.value.configured = true;
  auth.value.isLoading = false;
  auth.value.initializationError = null;
  auth.value.user = null;
  auth.value.accessToken = null;
  services.getMyGatherings.mockReset().mockResolvedValue([]);
  services.deleteMyGathering.mockReset().mockResolvedValue({ id: "gathering-1" });
  auth.value.signInWithGoogle.mockReset().mockResolvedValue(undefined);
  auth.value.signInWithEmail.mockReset().mockResolvedValue(undefined);
  auth.value.signOut.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AccountDialog", () => {
  it("inicia el OAuth real de Google", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /continuar con google/i }));
    await waitFor(() => expect(auth.value.signInWithGoogle).toHaveBeenCalledOnce());
  });

  it("envía el magic link y confirma el destino", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "Amiga@Ejemplo.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviarme un enlace/i }));

    await waitFor(() => {
      expect(auth.value.signInWithEmail).toHaveBeenCalledWith("amiga@ejemplo.com");
    });
    expect(await screen.findByText(/te enviamos un enlace/i)).toBeInTheDocument();
  });

  it("muestra la sesión activa y permite cerrarla", async () => {
    auth.value.user = {
      email: "tomy@example.com",
      user_metadata: { full_name: "Tomy Figueroa" },
    };
    renderDialog();

    expect(screen.getByText("Tomy Figueroa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    await waitFor(() => expect(auth.value.signOut).toHaveBeenCalledOnce());
  });

  it("recupera el historial y permite duplicar una juntada propia", async () => {
    auth.value.user = {
      email: "tomy@example.com",
      user_metadata: { full_name: "Tomy Figueroa" },
    };
    auth.value.accessToken = "valid-token";
    const gathering = {
      id: "gathering-1",
      slug: "asado-1",
      title: "Asado del sábado",
      status: "OPEN",
      organizerName: "Tomy",
      windowStart: "2026-09-05T22:00:00.000Z",
      windowEnd: "2026-09-06T02:00:00.000Z",
      createdAt: "2026-08-15T00:00:00.000Z",
      updatedAt: "2026-08-15T00:00:00.000Z",
      participantCount: 6,
      participant: {
        id: "participant-1",
        name: "Tomy",
        responseToken: "response-token",
        isOrganizer: true,
      },
    };
    services.getMyGatherings.mockResolvedValue([gathering]);
    const onDuplicateGathering = vi.fn();

    render(
      <MotionProvider>
        <AccountDialog
          open
          onClose={vi.fn()}
          onDuplicateGathering={onDuplicateGathering}
        />
      </MotionProvider>,
    );

    expect(await screen.findByText("Asado del sábado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Duplicar" }));
    expect(onDuplicateGathering).toHaveBeenCalledWith(gathering);
  });

  it("confirma y elimina una juntada propia del historial", async () => {
    auth.value.user = {
      email: "tomy@example.com",
      user_metadata: { full_name: "Tomy Figueroa" },
    };
    auth.value.accessToken = "valid-token";
    services.getMyGatherings.mockResolvedValue([
      {
        id: "gathering-1",
        slug: "asado-1",
        title: "Asado del sábado",
        status: "OPEN",
        organizerName: "Tomy",
        windowStart: "2026-09-05T22:00:00.000Z",
        windowEnd: "2026-09-06T02:00:00.000Z",
        createdAt: "2026-08-15T00:00:00.000Z",
        updatedAt: "2026-08-15T00:00:00.000Z",
        participantCount: 6,
        participant: {
          id: "participant-1",
          name: "Tomy",
          responseToken: "response-token",
          isOrganizer: true,
        },
      },
    ]);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderDialog();
    expect(await screen.findByText("Asado del sábado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(services.deleteMyGathering).toHaveBeenCalledWith(
        "gathering-1",
        "valid-token",
      );
    });
    expect(screen.queryByText("Asado del sábado")).not.toBeInTheDocument();
  });
});
