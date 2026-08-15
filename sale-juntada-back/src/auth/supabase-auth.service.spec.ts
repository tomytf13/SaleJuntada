import {
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseAuthService } from "./supabase-auth.service";

const getClaims = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ auth: { getClaims } })),
}));

function configuredService() {
  const config = {
    get: jest.fn((key: string) =>
      key === "SUPABASE_URL"
        ? "https://project.supabase.co"
        : "sb_publishable_test",
    ),
  } as unknown as ConfigService;
  return new SupabaseAuthService(config);
}

describe("SupabaseAuthService", () => {
  beforeEach(() => getClaims.mockReset());

  it("falla de forma explícita cuando Supabase no está configurado", async () => {
    const config = { get: jest.fn() } as unknown as ConfigService;
    const service = new SupabaseAuthService(config);

    await expect(service.requireIdentity("Bearer token")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("exige un Bearer token", async () => {
    await expect(configuredService().requireIdentity(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rechaza tokens que Supabase no puede verificar", async () => {
    const service = configuredService();
    getClaims.mockResolvedValue({
      data: null,
      error: new Error("invalid jwt"),
    });

    await expect(
      service.requireIdentity("Bearer invalid-token"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("devuelve sólo la identidad verificada del subject", async () => {
    const service = configuredService();
    getClaims.mockResolvedValue({
      data: { claims: { sub: "auth-user-id", email: "tomy@example.com" } },
      error: null,
    });

    await expect(service.requireIdentity("Bearer valid-token")).resolves.toEqual({
      id: "auth-user-id",
      email: "tomy@example.com",
    });
    expect(getClaims).toHaveBeenCalledWith("valid-token");
  });
});
