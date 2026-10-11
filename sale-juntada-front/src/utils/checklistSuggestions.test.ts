import { describe, expect, it } from "vitest";
import { checklistKind, detectChecklistTemplate, missingChecklistSuggestions } from "./checklistSuggestions";
describe("checklist suggestions", () => {
  it("detects gathering types and falls back for unrelated words", () => {
    expect(detectChecklistTemplate("Asadito del sábado")).toBe("asado");
    expect(detectChecklistTemplate("Cumple x3")).toBe("cumple");
    expect(detectChecklistTemplate("Picnic en el parque")).toBe("picnic");
    expect(detectChecklistTemplate("Repasado del examen")).toBe("general");
  });
  it("recognizes accents and supplies a fallback icon", () => {
    expect(checklistKind("2 bolsas de carbón")).toBe("coal");
    expect(checklistKind("HIELO")).toBe("ice");
    expect(checklistKind("Pinzas para la parrilla")).toBe("tools");
    expect(checklistKind("Carne para todos")).toBe("meat");
    expect(checklistKind("Buscar a Sofi")).toBe("other");
  });
  it("avoids recommendations already covered by spelling variants", () => {
    const suggestions = missingChecklistSuggestions("asado", ["CARBON", "Una bolsa de hielos", "Pinzas para asar"]);
    expect(suggestions).not.toContain("Carbón");
    expect(suggestions).not.toContain("Hielo");
    expect(suggestions).not.toContain("Herramientas para el asado");
    expect(suggestions).toContain("Carne");
    expect(missingChecklistSuggestions("cumple", [])).toContain("Torta");
  });
});
