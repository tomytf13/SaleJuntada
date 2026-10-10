import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, useParams } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const auth = vi.hoisted(() => ({
  value: {
    configured: true,
    isLoading: false,
    initializationError: null as string | null,
    user: null as null | { email?: string; user_metadata: Record<string, unknown> },
    accessToken: null as string | null,
    signInWithGoogle: vi.fn(),
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("./auth/useAuth", () => ({ useAuth: () => auth.value }));

function GatheringPageStub() {
  const { slug } = useParams<{ slug: string }>();
  return <div>GATHERING_PAGE_STUB slug={slug}</div>;
}

vi.mock("./routes/GatheringPage", () => ({
  default: () => <GatheringPageStub />,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App routing", () => {
  it("/ renders the real landing page, not a fake gathering", async () => {
    renderAt("/");

    expect(
      await screen.findByRole("button", { name: /crear una juntada/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Asado con los pibes")).not.toBeInTheDocument();
    expect(screen.queryByText(/GATHERING_PAGE_STUB/)).not.toBeInTheDocument();
  });

  it("/j/:slug renders GatheringPage with the slug from the route", async () => {
    renderAt("/j/asado-demo-tucuman");

    expect(
      await screen.findByText("GATHERING_PAGE_STUB slug=asado-demo-tucuman"),
    ).toBeInTheDocument();
  });

  it("an unknown route renders NotFoundPage", async () => {
    renderAt("/esto-no-existe");

    expect(
      await screen.findByText(/no encontramos esta página/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /volver al inicio/i }),
    ).toBeInTheDocument();
  });
});
