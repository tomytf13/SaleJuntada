import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MobileDashboard,
  PurchasePlanner,
} from "./MobileExperience";
import { gatheringService, type PurchasePlan } from "../services/gatheringService";

const sharedPlan: PurchasePlan = {
  id: "plan",
  persisted: true,
  includeAlcohol: false,
  ageConfirmed: false,
  participantCount: 6,
  participantBaseline: 6,
  updatedAt: "2026-08-11T00:00:00.000Z",
  items: [
    { key: "meat", label: "Carne", unit: "kg", quantity: 3, suggestedQuantity: 3, category: "food", position: 0 },
    { key: "beer", label: "Cerveza", unit: "litros", quantity: 6, suggestedQuantity: 6, category: "alcohol", position: 1 },
  ],
};

afterEach(cleanup);

describe("MobileDashboard", () => {
  it("connects the active gathering summary with the real actions", () => {
    const onAvailability = vi.fn();
    const onResults = vi.fn();

    render(
      <MobileDashboard
        eventName="Asado en casa"
        location="San Miguel de Tucumán"
        active
        selectedCount={2}
        responseCount={4}
        match={{
          weekday: "SÁB",
          day: "25",
          title: "Sábado 25",
          detail: "21:00 · Centro",
          available: 4,
          total: 6,
          pill: "Mejor opción",
        }}
        onCreate={vi.fn()}
        onShare={vi.fn()}
        onOpenAvailability={onAvailability}
        onOpenResults={onResults}
      />,
    );

    expect(screen.getByText("Asado en casa")).toBeInTheDocument();
    expect(screen.getByText("4/6 respondieron")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /editar mis horarios/i }));
    fireEvent.click(screen.getByRole("button", { name: /ver resultados/i }));

    expect(onAvailability).toHaveBeenCalledOnce();
    expect(onResults).toHaveBeenCalledOnce();
  });
});

describe("PurchasePlanner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("keeps alcohol optional and requires an adult confirmation before sharing", async () => {
    const onNotice = vi.fn();
    render(
      <PurchasePlanner
        gatheringKey="test-gathering"
        participantCount={6}
        onNotice={onNotice}
      />,
    );

    expect(screen.queryByText("Cerveza")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("Cerveza")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /compartir lista/i }));
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/mayor de 18 años/i));

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /compartir lista/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("Cerveza"));
  });

  it("calcula la sugerencia inicial usando el tamaño del grupo", () => {
    render(
      <PurchasePlanner
        gatheringKey="dynamic-demo"
        participantCount={10}
        onNotice={vi.fn()}
      />,
    );

    const meatRow = screen
      .getByText("Carne")
      .closest(".purchase-item") as HTMLElement | null;
    expect(meatRow).not.toBeNull();
    expect(within(meatRow!).getByText(/sugerido 5/i)).toBeInTheDocument();
  });

  it("deja la compra compartida en modo lectura para invitados", async () => {
    vi.spyOn(gatheringService, "getPurchasePlan").mockResolvedValue(sharedPlan);

    render(
      <PurchasePlanner
        gatheringKey="gathering"
        gatheringId="gathering"
        participantId="guest"
        participantToken="token"
        participantCount={6}
        canEdit={false}
        onNotice={vi.fn()}
      />,
    );

    await screen.findByText("Sólo lectura");
    expect(screen.getByRole("button", { name: /agregar carne/i })).toBeDisabled();
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("sincroniza los cambios del organizador después del debounce", async () => {
    vi.spyOn(gatheringService, "getPurchasePlan").mockResolvedValue(sharedPlan);
    const update = vi
      .spyOn(gatheringService, "updatePurchasePlan")
      .mockResolvedValue({
        ...sharedPlan,
        items: sharedPlan.items.map((item) =>
          item.key === "meat" ? { ...item, quantity: 4 } : item,
        ),
      });

    render(
      <PurchasePlanner
        gatheringKey="gathering"
        gatheringId="gathering"
        participantId="organizer"
        participantToken="token"
        participantCount={6}
        canEdit
        onNotice={vi.fn()}
      />,
    );

    await screen.findByText("Sincronizada");
    fireEvent.click(screen.getByRole("button", { name: /agregar carne/i }));

    await waitFor(() => expect(update).toHaveBeenCalledOnce(), { timeout: 1_500 });
    expect(update).toHaveBeenCalledWith(
      "gathering",
      "organizer",
      "token",
      expect.objectContaining({
        items: expect.arrayContaining([{ key: "meat", quantity: 4 }]),
      }),
    );
  });
});
