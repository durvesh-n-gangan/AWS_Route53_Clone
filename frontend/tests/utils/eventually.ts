import { act } from "@testing-library/react";

/**
 * Polls `assertion` until it passes, letting React flush between attempts.
 *
 * Use this instead of Testing Library's `waitFor` when a Cloudscape FormField shows an
 * error asynchronously: in jsdom the field's screen-reader live region and waitFor's
 * MutationObserver keep re-triggering each other and the test never finishes.
 */
export async function eventually(assertion: () => void, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  for (;;) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - started > timeoutMs) throw error;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
}
