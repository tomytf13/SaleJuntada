import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Gathering } from "../services/gatheringService";
import { GatheringManagementDialog } from "./GatheringManagementDialog";

const gathering: Gathering = {
  id: "gathering",
  slug: "asado-demo",
  title: "Asado demo",
  organizerName: "Tomy",
  locationHint: "Yerba Buena",
  windowStart: "2026-08-20T22:00:00.000Z",
  windowEnd: "2026-08-23T05:00:00.000Z",
  durationMinutes: 180,
  dailyStartMinutes: 1140,
  dailyEndMinutes: 1560,
  slotStepMinutes: 60,
  status: "OPEN",
  participants: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GatheringManagementDialog", () => {
  it("guarda cambios no destructivos sin borrar respuestas", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm");
    render(
      <GatheringManagementDialog
        open
        gathering={gathering}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
        onCancelGathering={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Nombre de la juntada/i), {
      target: { value: "Asado de cumple" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Asado de cumple" }),
      ),
    );
    expect(confirm).not.toHaveBeenCalled();
  });

  it("pide confirmación antes de cancelar", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onCancelGathering = vi.fn().mockResolvedValue(undefined);
    render(
      <GatheringManagementDialog
        open
        gathering={gathering}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onCancelGathering={onCancelGathering}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Cancelar esta juntada/i }),
    );

    await waitFor(() => expect(onCancelGathering).toHaveBeenCalledOnce());
  });
});
