import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogProduct } from "../services/gatheringService";
import { PurchaseCatalogSelector } from "./PurchaseCatalogSelector";

afterEach(cleanup);

const products: CatalogProduct[] = [
  {
    id: "cola",
    key: "soda-cola",
    categoryKey: "soda",
    name: "Gaseosa cola",
    brand: null,
    description: "Gaseosa sabor cola",
    visualKey: "cola",
    accentColor: "#93433b",
    tags: ["gaseosa"],
    isAlcohol: false,
    presentations: [
      { id: "large", key: "2250ml", label: "Botella 2,25 L", unit: "botellas de 2,25 L" },
    ],
  },
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `option-${index}`,
    key: `option-${index}`,
    categoryKey: "soda",
    name: `Opción ${index}`,
    brand: null,
    description: null,
    visualKey: "water",
    accentColor: "#4b91aa",
    tags: index === 0 ? ["sin azúcar"] : [],
    isAlcohol: false,
    presentations: [],
  })),
];

describe("PurchaseCatalogSelector", () => {
  it("permite buscar, elegir producto y presentación", () => {
    const onSelect = vi.fn();
    const onSelectPresentation = vi.fn();
    render(
      <PurchaseCatalogSelector
        categoryLabel="Gaseosas y bebidas sin alcohol"
        products={products}
        selectedProductId="cola"
        selectedPresentationId="large"
        customMode={false}
        onSelect={onSelect}
        onSelectPresentation={onSelectPresentation}
        onCustom={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Gaseosa cola/i }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "sin azúcar" } });
    expect(screen.getByRole("button", { name: /Opción 0/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Gaseosa cola/i })).toBeNull();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "cola" } });
    fireEvent.click(screen.getByRole("button", { name: /Gaseosa cola/i }));
    expect(onSelect).toHaveBeenCalledWith(products[0]);
    fireEvent.click(screen.getByRole("button", { name: "Botella 2,25 L" }));
    expect(onSelectPresentation).toHaveBeenCalledWith("large");
  });

  it("mantiene una alternativa manual siempre visible", () => {
    const onCustom = vi.fn();
    render(
      <PurchaseCatalogSelector
        categoryLabel="Snacks"
        products={products}
        selectedProductId=""
        selectedPresentationId=""
        customMode
        onSelect={vi.fn()}
        onSelectPresentation={vi.fn()}
        onCustom={onCustom}
      />,
    );
    const custom = screen.getByRole("button", { name: /Otra opción/i });
    expect(custom.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(custom);
    expect(onCustom).toHaveBeenCalledOnce();
  });
});
