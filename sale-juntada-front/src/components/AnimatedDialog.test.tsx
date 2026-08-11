import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionProvider } from "../motion/MotionProvider";
import { AnimatedDialog } from "./AnimatedDialog";

afterEach(cleanup);

describe("AnimatedDialog", () => {
  it("mantiene semántica de diálogo y cierra con Escape", async () => {
    const onClose = vi.fn();
    render(
      <MotionProvider>
        <AnimatedDialog
          open
          onClose={onClose}
          panelClassName="create-sheet"
          label="Crear juntada"
        >
          <h2 id="dialog-title">Crear juntada</h2>
          <button type="button">Continuar</button>
        </AnimatedDialog>
      </MotionProvider>,
    );

    expect(screen.getByRole("dialog", { name: "Crear juntada" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
