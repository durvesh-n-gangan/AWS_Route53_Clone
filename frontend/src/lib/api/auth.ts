import { apiFetch } from "@/lib/api/client";
import type { CurrentUser, LoginInput } from "@/types/api";

export const authApi = {
  login: (input: LoginInput) =>
    apiFetch<CurrentUser>("/auth/login", { method: "POST", body: input }),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  me: () => apiFetch<CurrentUser>("/auth/me"),
};
