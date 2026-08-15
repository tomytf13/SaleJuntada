import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PartyGames } from "./PartyGames";

describe("PartyGames", () => {
  it("permite sacar y cambiar tarjetas sin exigir alcohol", () => {
    render(<PartyGames />);

    fireEvent.click(screen.getByRole("button", { name: /sacar tarjeta/i }));
    expect(screen.queryByText(/tocá el botón/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /brindis \+18/i }));
    expect(
      screen.getByRole("button", { name: /sacar tarjeta/i }),
    ).toBeDisabled();
    expect(screen.getByText(/bebida sin alcohol/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      screen.getByRole("button", { name: /sacar tarjeta/i }),
    ).toBeEnabled();
  });
});
