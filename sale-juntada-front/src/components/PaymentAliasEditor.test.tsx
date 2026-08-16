import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentAliasEditor } from "./PaymentAliasEditor";

afterEach(cleanup);

describe("PaymentAliasEditor", () => {
  it("normaliza y guarda un alias válido", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <PaymentAliasEditor
        paymentAlias={null}
        persistsToProfile
        isSaving={false}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Tu alias/i), {
      target: { value: "  MATE.Asado-26  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar alias/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("mate.asado-26"));
  });

  it("explica el formato sin enviar un alias inválido", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <PaymentAliasEditor
        paymentAlias={null}
        persistsToProfile={false}
        isSaving={false}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Tu alias/i), {
      target: { value: "corto" },
    });
    fireEvent.submit(screen.getByLabelText(/Tu alias/i).closest("form")!);

    expect(screen.getByRole("alert").textContent).toMatch(/6 y 20/);
    expect(onSave).not.toHaveBeenCalled();
  });
});
