import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
        expect.objectContaining({
          title: "Asado de cumple",
          windowStart: gathering.windowStart,
          windowEnd: gathering.windowEnd,
        }),
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

it("confirma 21 a 04 del día siguiente con siete horas, en la zona del evento", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <GatheringManagementDialog
      open
      gathering={{
        ...gathering,
        timeZone: "America/Argentina/Tucuman",
        windowStart: "2026-10-11T01:00:00.000Z",
        windowEnd: "2026-10-11T07:00:00.000Z",
        dailyStartMinutes: 1320,
        dailyEndMinutes: 1680,
        durationMinutes: 300,
      }}
      isSaving={false}
      onClose={vi.fn()}
      onSave={onSave}
      onCancelGathering={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Tipo de horario"), {
    target: { value: "fixed" },
  });
  fireEvent.change(screen.getByLabelText("Desde las"), {
    target: { value: "21:00" },
  });
  expect(screen.getByLabelText("Día de inicio")).toHaveValue("2026-10-10");
  expect(screen.getByLabelText("Día de finalización")).toHaveValue(
    "2026-10-11",
  );
  expect(screen.getByRole("status")).toHaveTextContent("420 minutos (7 horas)");
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        fixedSchedule: true,
        windowStart: "2026-10-11T00:00:00.000Z",
        windowEnd: "2026-10-11T07:00:00.000Z",
        durationMinutes: 420,
        dailyStartMinutes: 1260,
        dailyEndMinutes: 1680,
      }),
    ),
  );
});
