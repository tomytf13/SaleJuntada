import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GatheringServiceSettings } from "./GatheringServiceSettings";
import {
  gatheringService,
  type ExpenseSettlement,
  type Gathering,
  type Participant,
} from "../services/gatheringService";

const gathering = {
  id: "g",
  slug: "asado",
  status: "CONFIRMED",
  disabledServices: [],
} as unknown as Gathering;
const participant = { id: "me", isOrganizer: true } as Participant;
const settled = {
  expenses: [],
  transfers: [],
  allReady: false,
} as unknown as ExpenseSettlement;
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function show(
  settlement: ExpenseSettlement | null = settled,
  value = gathering,
) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <GatheringServiceSettings
          gathering={value}
          participant={participant}
          token="secret"
          settlement={settlement}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("gestión de servicios", () => {
  it("recupera el estado ante un fallo y permite reintentar", async () => {
    const mutation = vi
      .spyOn(gatheringService, "setGatheringService")
      .mockRejectedValueOnce(new Error("No pudimos guardar. Reintentá."))
      .mockResolvedValueOnce({ disabledServices: ["juegos"] });
    show();
    const user = userEvent.setup();
    const games = screen.getByRole("switch", { name: "Juegos" });
    await user.click(games);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos guardar",
    );
    await waitFor(() => expect(games).toBeEnabled());
    expect(games).toBeChecked();
    await user.click(games);
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2));
    expect(mutation).toHaveBeenLastCalledWith(
      "g",
      "me",
      "secret",
      "juegos",
      false,
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Servicios actualizados",
    );
  });
  it.each([
    null,
    { ...settled, expenses: [{ id: "expense" }] },
    { ...settled, allReady: true, transfers: [{ amountCents: 100 }] },
  ])(
    "no permite archivar cuentas sin comprobar que están cerradas",
    (settlement) => {
      show(settlement as ExpenseSettlement | null);
      expect(
        screen.getByRole("switch", { name: "Gastos y cuentas" }),
      ).toBeDisabled();
    },
  );
  it("permite reactivar cuentas archivadas y mantiene los servicios base", () => {
    show(null, { ...gathering, disabledServices: ["cuentas"] });
    expect(
      screen.getByRole("switch", { name: "Gastos y cuentas" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("switch", { name: "Invitados" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Fecha y lugar" }),
    ).not.toBeInTheDocument();
  });
});
