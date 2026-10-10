import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AddParticipantDto } from "./add-participant.dto";
import { AuthParticipantDto } from "./auth-participant.dto";

for (const Dto of [AddParticipantDto, AuthParticipantDto]) {
  describe(`${Dto.name} contact`, () => {
    it("normaliza un teléfono internacional sin afirmar que está verificado", async () => {
      const dto = plainToInstance(Dto, {
        name: "Sofi",
        contact: "+54 (9) 381-123-4567",
      });
      expect(await validate(dto)).toEqual([]);
      expect(dto.contact).toBe("+5493811234567");
    });
    it.each([
      "3811234567",
      "+0123456789",
      "+123",
      "sofi@example.com",
      "+1234567890123456",
      123,
    ])("rechaza contacto inválido %s", async (contact) => {
      const dto = plainToInstance(Dto, { name: "Sofi", contact });
      expect(
        (await validate(dto)).some((error) => error.property === "contact"),
      ).toBe(true);
    });
    it.each([undefined, "", "   "])(
      "permite omitir el teléfono (%s)",
      async (contact) => {
        const dto = plainToInstance(Dto, { name: "Sofi", contact });
        expect(await validate(dto)).toEqual([]);
        expect(dto.contact).toBeUndefined();
      },
    );
  });
}
