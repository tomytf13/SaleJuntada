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
    { key: "meat", label: "Comida principal", unit: "aportes", quantity: 1, suggestedQuantity: 1, category: "food", position: 0, assignedTo: null, assignedAt: null, isReady: false, contributions: [] },
    { key: "beer", label: "Bebidas con alcohol", unit: "aportes", quantity: 1, suggestedQuantity: 1, category: "alcohol", position: 1, assignedTo: null, assignedAt: null, isReady: false, contributions: [] },
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

    expect(screen.queryByText("Bebidas con alcohol")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("Bebidas con alcohol")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /compartir lista/i }));
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/mayor de 18 años/i));

  });

  it("usa categorías amplias e incluye snacks", () => {
    render(
      <PurchasePlanner
        gatheringKey="dynamic-demo"
        participantCount={10}
        onNotice={vi.fn()}
      />,
    );

    expect(screen.getByText("Comida principal")).toBeInTheDocument();
    expect(screen.getByText("Snacks")).toBeInTheDocument();
    expect(screen.getByText(/papas, maní y más/i)).toBeInTheDocument();
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

    await screen.findByText("Lista compartida");
    expect(screen.getAllByRole("button", { name: /sumar mi aporte/i })[0]).toBeEnabled();
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("permite especificar el aporte dentro de una categoría", async () => {
    vi.spyOn(gatheringService, "getPurchasePlan").mockResolvedValue(sharedPlan);
    const assignedPlan: PurchasePlan = {
      ...sharedPlan,
      items: sharedPlan.items.map((item) => item.key === "meat"
        ? {
            ...item,
            contributions: [{
              id: "contribution",
              description: "2 Coca-Cola sin azúcar",
              quantity: 2,
              unit: "botellas",
              note: null,
              isReady: false,
              createdAt: "2026-08-13T12:00:00.000Z",
              updatedAt: "2026-08-13T12:00:00.000Z",
              participant: { id: "guest", name: "Mica", avatarUrl: "emoji:🥳" },
            }],
          }
        : item),
    };
    const updateContribution = vi
      .spyOn(gatheringService, "upsertPurchaseContribution")
      .mockResolvedValue(assignedPlan);

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

    const tile = await screen.findByTestId("responsibility-meat");
    fireEvent.click(within(tile).getByRole("button", { name: /sumar mi aporte/i }));
    fireEvent.change(within(tile).getByLabelText(/qué vas a llevar/i), {
      target: { value: "2 Coca-Cola sin azúcar" },
    });
    fireEvent.change(within(tile).getByLabelText(/presentación/i), {
      target: { value: "botellas" },
    });
    fireEvent.click(within(tile).getByRole("button", { name: /guardar aporte/i }));

    await waitFor(() => expect(updateContribution).toHaveBeenCalledWith(
      "gathering",
      "guest",
      "token",
      "meat",
      expect.objectContaining({
        description: "2 Coca-Cola sin azúcar",
        quantity: 1,
        unit: "botellas",
      }),
    ));
    expect(await within(tile).findByText("2 Coca-Cola sin azúcar")).toBeInTheDocument();
  });

  it("sincroniza la habilitación de alcohol del organizador", async () => {
    vi.spyOn(gatheringService, "getPurchasePlan").mockResolvedValue(sharedPlan);
    const update = vi
      .spyOn(gatheringService, "updatePurchasePlan")
      .mockResolvedValue({
        ...sharedPlan,
        includeAlcohol: true,
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
    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(update).toHaveBeenCalledOnce(), { timeout: 1_500 });
    expect(update).toHaveBeenCalledWith(
      "gathering",
      "organizer",
      "token",
      expect.objectContaining({
        includeAlcohol: true,
      }),
    );
  });
});
