import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AuthIdentity = {
  id: string;
  email: string | null;
};

@Injectable()
export class SupabaseAuthService {
  private readonly client: SupabaseClient | null;

  constructor(config: ConfigService) {
    const url = config.get<string>("SUPABASE_URL")?.trim();
    const publishableKey = config
      .get<string>("SUPABASE_PUBLISHABLE_KEY")
      ?.trim();

    this.client =
      url && publishableKey
        ? createClient(url, publishableKey, {
            auth: {
              autoRefreshToken: false,
              detectSessionInUrl: false,
              persistSession: false,
            },
          })
        : null;
  }

  async requireIdentity(authorization: string | undefined): Promise<AuthIdentity> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "El acceso con Supabase todavía no está configurado",
      );
    }

    const token = this.readBearerToken(authorization);
    const { data, error } = await this.client.auth.getClaims(token);
    const subject = data?.claims?.sub;
    if (error || typeof subject !== "string" || !subject) {
      throw new UnauthorizedException("Tu sesión venció. Volvé a ingresar");
    }

    return {
      id: subject,
      email:
        typeof data.claims.email === "string" ? data.claims.email : null,
    };
  }

  async optionalIdentity(
    authorization: string | undefined,
  ): Promise<AuthIdentity | null> {
    if (!authorization?.trim()) return null;
    return this.requireIdentity(authorization);
  }

  private readBearerToken(authorization: string | undefined) {
    const [scheme, token] = authorization?.trim().split(/\s+/) ?? [];
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException("Necesitás ingresar a tu cuenta");
    }
    return token;
  }
}
