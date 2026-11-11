"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi } from "@/lib/api/auth";
import { hardNavigate } from "@/lib/auth/session";
import { ROUTES } from "@/lib/navigation";

export const authKeys = {
  me: ["auth", "me"] as const,
};

/** The signed-in user. A 401 here is handled globally (see lib/queryClient.ts). */
export function useMe() {
  return useQuery({ queryKey: authKeys.me, queryFn: authApi.me, staleTime: 5 * 60_000 });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    // A wrong password is an expected 401 and must not trigger the "session expired" flow.
    meta: { skipUnauthorizedRedirect: true },
    onSuccess: (user) => queryClient.setQueryData(authKeys.me, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    meta: { skipUnauthorizedRedirect: true },
    onSettled: () => {
      queryClient.clear();
      hardNavigate(ROUTES.login);
    },
  });
}
