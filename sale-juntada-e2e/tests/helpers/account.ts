import type { Page } from "@playwright/test";

/** Cuenta ficticia sólo para pruebas con API interceptada; la API real la rechaza. */
export async function mockAccount(page: Page) {
  await page.addInitScript(() => {
    const user = { id: "account-e2e", aud: "authenticated", role: "authenticated", email: "qa@example.test", app_metadata: { provider: "google", providers: ["google"] }, user_metadata: { full_name: "Sofi" }, created_at: new Date().toISOString() };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const access_token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp, role: "authenticated" })}.test-signature`;
    localStorage.setItem("sb-auth-auth-token", JSON.stringify({ access_token, refresh_token: "test-refresh", expires_at: exp, expires_in: 3600, token_type: "bearer", user }));
  });
}


export const realAccountsConfigured = Boolean(process.env.E2E_AUTH_TOKEN && process.env.E2E_FRIEND_AUTH_TOKEN && process.env.VITE_SUPABASE_URL);

export async function realAccount(page: Page, accessToken = process.env.E2E_AUTH_TOKEN!) {
  const claims = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
  const project = new URL(process.env.VITE_SUPABASE_URL!).hostname.split(".")[0];
  await page.addInitScript(({ token, claims, project }) => {
    localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify({ access_token: token, expires_at: claims.exp, expires_in: claims.exp - Math.floor(Date.now() / 1000), refresh_token: "", token_type: "bearer", user: { id: claims.sub, email: claims.email, aud: "authenticated", app_metadata: claims.app_metadata ?? {}, user_metadata: claims.user_metadata ?? {} } }));
  }, { token: accessToken, claims, project });
}
