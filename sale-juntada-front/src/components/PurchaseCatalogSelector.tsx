import { useMemo, useState, type CSSProperties } from "react";
import { Search } from "lucide-react";
import type { CatalogProduct } from "../services/gatheringService";

const productGlyphs: Record<string, string> = {
  grill: "🥩", burger: "🍔", pizza: "🍕", empanada: "🥟",
  sandwich: "🥪", veggie: "🌱", salad: "🥗", bread: "🥖",
  potatoes: "🥔", sauce: "🥫", chips: "🥔", nachos: "🔺",
  peanuts: "🥜", sticks: "🥨", "cheese-snack": "🧀", "snack-mix": "🍿",
  icecream: "🍨", cake: "🍰", flan: "🍮", fruit: "🍓", sweets: "🍬",
  cola: "🥤", "cola-zero": "🥤", "lemon-lime": "🍋", "orange-soda": "🍊",
  water: "💧", "flavored-water": "🫧", juice: "🧃", ice: "🧊",
  charcoal: "⚫", wood: "🪵", lighter: "🔥", beer: "🍺", fernet: "🥃",
  "red-wine": "🍷", "white-wine": "🥂", gin: "🍸", vodka: "🍸",
  cider: "🍾", cups: "🥛", tableware: "🍽️", napkins: "◻️", "trash-bag": "♻️",
};

type Props = {
  categoryLabel: string;
  products: CatalogProduct[];
  selectedProductId: string;
  selectedPresentationId: string;
  customMode: boolean;
  onSelect(product: CatalogProduct): void;
  onSelectPresentation(id: string): void;
  onCustom(): void;
};

export function PurchaseCatalogSelector({
  categoryLabel,
  products,
  selectedProductId,
  selectedPresentationId,
  customMode,
  onSelect,
  onSelectPresentation,
  onCustom,
}: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
  const filteredProducts = useMemo(
    () => products.filter((product) =>
      [product.name, product.brand, product.description, ...product.tags]
        .filter(Boolean)
        .some((text) => text!.toLocaleLowerCase("es-AR").includes(normalizedQuery)),
    ),
    [normalizedQuery, products],
  );
  const selectedProduct = products.find((product) => product.id === selectedProductId);

  return (
    <fieldset className="catalog-selector">
      <legend>Elegí dentro de {categoryLabel.toLocaleLowerCase("es-AR")}</legend>
      {products.length > 6 ? (
        <label className="catalog-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Buscar producto</span>
          <input
            type="search"
            value={query}
            placeholder="Buscar una opción…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      ) : null}
      <div className="catalog-product-grid" aria-label={`Opciones de ${categoryLabel}`}>
        {filteredProducts.map((product) => {
          const selected = !customMode && product.id === selectedProductId;
          return (
            <button
              type="button"
              key={product.id}
              className={selected ? "selected" : ""}
              aria-pressed={selected}
              onClick={() => onSelect(product)}
            >
              <span
                className="catalog-product-art"
                style={{ "--product-accent": product.accentColor } as CSSProperties}
                aria-hidden="true"
              >
                {productGlyphs[product.visualKey] ?? "🛍️"}
              </span>
              <span>
                <b>{product.name}</b>
                {product.tags[0] ? <small>{product.tags[0]}</small> : null}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className={`catalog-custom ${customMode ? "selected" : ""}`}
          aria-pressed={customMode}
          onClick={onCustom}
        >
          <span className="catalog-product-art" aria-hidden="true">✍️</span>
          <span><b>Otra opción</b><small>Escribir manualmente</small></span>
        </button>
      </div>
      {!filteredProducts.length ? (
        <p className="catalog-empty">No encontramos esa opción. Podés usar “Otra opción”.</p>
      ) : null}
      {selectedProduct && !customMode ? (
        <div className="catalog-presentations">
          <span>Presentación</span>
          <div>
            {selectedProduct.presentations.map((presentation) => (
              <button
                type="button"
                key={presentation.id}
                className={presentation.id === selectedPresentationId ? "selected" : ""}
                aria-pressed={presentation.id === selectedPresentationId}
                onClick={() => onSelectPresentation(presentation.id)}
              >
                {presentation.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
