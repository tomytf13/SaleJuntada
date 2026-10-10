import { describe, expect, it } from "vitest";
import { normalizeContactPhone, phoneCountries } from "./phone";

describe("teléfono por país", () => {
  it("combina el número argentino con su prefijo", () => {
    expect(normalizeContactPhone("9 381 123 4567", "AR")).toBe("+5493811234567");
  });
  it("normaliza un celular escrito en formato local argentino", () => {
    expect(normalizeContactPhone("0381 15 123 4567", "AR")).toBe("+5493811234567");
  });
  it("usa el prefijo del país seleccionado", () => {
    expect(normalizeContactPhone("612 345 678", "ES")).toBe("+34612345678");
  });
  it("admite pegar el número internacional sin duplicar el prefijo", () => {
    expect(normalizeContactPhone("+54 (9) 381-123-4567", "AR")).toBe("+5493811234567");
  });
  it("rechaza un prefijo distinto y números incompletos", () => {
    expect(() => normalizeContactPhone("+34612345678", "AR")).toThrow(/país elegido/);
    expect(() => normalizeContactPhone("123", "AR")).toThrow(/código de área/);
  });
  it("no guarda un prefijo solo cuando el teléfono es opcional", () => {
    expect(normalizeContactPhone("", "AR")).toBeUndefined();
  });
  it("distingue países que comparten prefijo", () => {
    expect(phoneCountries.find((item) => item.country === "US")).toMatchObject({ flag: "🇺🇸", prefix: "+1" });
    expect(phoneCountries.find((item) => item.country === "CA")).toMatchObject({ flag: "🇨🇦", prefix: "+1" });
  });
});
