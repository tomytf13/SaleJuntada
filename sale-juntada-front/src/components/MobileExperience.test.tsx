import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MobileDashboard,
  PurchasePlanner,
} from "./MobileExperience";

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
});
