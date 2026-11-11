import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { createQueryClient } from "@/lib/queryClient";

const unauthorized = () => new ApiError(401, "Unauthenticated", "Session expired.");

describe("global 401 handling", () => {
  it("signs the user out when any query gets a 401", async () => {
    const onUnauthorized = vi.fn();
    const client = createQueryClient(onUnauthorized);

    await client
      .fetchQuery({ queryKey: ["zones"], queryFn: () => Promise.reject(unauthorized()) })
      .catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("signs the user out when a mutation gets a 401", async () => {
    const onUnauthorized = vi.fn();
    const client = createQueryClient(onUnauthorized);

    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(unauthorized()) })
      .execute(undefined)
      .catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("leaves 401s alone for mutations that opt out (a wrong password)", async () => {
    const onUnauthorized = vi.fn();
    const client = createQueryClient(onUnauthorized);

    await client
      .getMutationCache()
      .build(client, {
        mutationFn: () => Promise.reject(unauthorized()),
        meta: { skipUnauthorizedRedirect: true },
      })
      .execute(undefined)
      .catch(() => undefined);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("ignores other errors", async () => {
    const onUnauthorized = vi.fn();
    const client = createQueryClient(onUnauthorized);

    await client
      .fetchQuery({
        queryKey: ["zones"],
        queryFn: () => Promise.reject(new ApiError(404, "NotFound", "nope")),
      })
      .catch(() => undefined);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
