import {
  PARTICIPANT_TOKEN_LENGTH,
  generateParticipantToken,
  participantTokenMatches,
} from "./participant-token";

describe("generateParticipantToken", () => {
  it("produce un token con la longitud esperada de 32 bytes en base64url", () => {
    expect(generateParticipantToken()).toHaveLength(PARTICIPANT_TOKEN_LENGTH);
  });

  it("usa sólo el alfabeto base64url, sin relleno", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(generateParticipantToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("no repite tokens", () => {
    const tokens = new Set(
      Array.from({ length: 1_000 }, () => generateParticipantToken()),
    );
    expect(tokens.size).toBe(1_000);
  });

  it("no genera tokens con forma de cuid", () => {
    // Un cuid v1 arranca con "c" y mide 25 caracteres. Este test falla si
    // alguien vuelve a poner `@default(cuid())` sobre el campo.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const token = generateParticipantToken();
      expect(token.length).not.toBe(25);
    }
  });
});

describe("participantTokenMatches", () => {
  it("acepta el token correcto", () => {
    const token = generateParticipantToken();
    expect(participantTokenMatches(token, token)).toBe(true);
  });

  it("rechaza un token distinto de la misma longitud", () => {
    expect(
      participantTokenMatches(
        generateParticipantToken(),
        generateParticipantToken(),
      ),
    ).toBe(false);
  });

  it("rechaza un token de otra longitud sin romperse", () => {
    // `timingSafeEqual` lanza si los buffers no miden igual: la comparación
    // de longitudes tiene que ocurrir antes.
    const stored = generateParticipantToken();
    expect(participantTokenMatches("corto", stored)).toBe(false);
    expect(participantTokenMatches(`${stored}extra`, stored)).toBe(false);
  });

  it("rechaza la ausencia de token", () => {
    expect(participantTokenMatches(undefined, generateParticipantToken())).toBe(
      false,
    );
    expect(participantTokenMatches("", generateParticipantToken())).toBe(false);
  });

  it("rechaza un prefijo correcto", () => {
    const stored = generateParticipantToken();
    expect(participantTokenMatches(stored.slice(0, -1), stored)).toBe(false);
  });
});
