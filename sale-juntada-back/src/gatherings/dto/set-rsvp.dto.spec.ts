import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { MAX_PLUS_ONES, SetRsvpDto } from "./set-rsvp.dto";

function validate(payload: unknown) {
  return validateSync(plainToInstance(SetRsvpDto, payload));
}

describe("SetRsvpDto", () => {
  it("acepta los tres estados válidos", () => {
    for (const status of ["GOING", "MAYBE", "NOT_GOING"]) {
      expect(validate({ status })).toHaveLength(0);
    }
  });

  it("rechaza un estado que no está en el enum", () => {
    const errors = validate({ status: "TAL_VEZ" });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("status");
  });

  it("rechaza la falta de estado", () => {
    expect(validate({})).toHaveLength(1);
  });

  it("acepta acompañantes dentro del rango", () => {
    expect(validate({ status: "GOING", plusOnes: 0 })).toHaveLength(0);
    expect(validate({ status: "GOING", plusOnes: MAX_PLUS_ONES })).toHaveLength(0);
  });

  it("rechaza acompañantes negativos", () => {
    const errors = validate({ status: "GOING", plusOnes: -1 });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("plusOnes");
  });

  it("rechaza un número absurdo de acompañantes", () => {
    const errors = validate({ status: "GOING", plusOnes: MAX_PLUS_ONES + 1 });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("plusOnes");
  });

  it("rechaza acompañantes con decimales", () => {
    expect(validate({ status: "GOING", plusOnes: 1.5 })).toHaveLength(1);
  });

  it("permite omitir los acompañantes", () => {
    expect(validate({ status: "GOING" })).toHaveLength(0);
  });
});
