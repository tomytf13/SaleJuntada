import type { User } from "@supabase/supabase-js";
import { createContext } from "react";

export type AuthContextValue = {
  configured: boolean;
  isLoading: boolean;
  initializationError: string | null;
  user: User | null;
  accessToken: string | null;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
