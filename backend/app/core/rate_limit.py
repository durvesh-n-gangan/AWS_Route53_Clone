"""A small in-memory throttle for failed sign-ins.

Good enough for a single-process demo: counts are kept per (client IP, username) and are
lost on restart. A multi-instance deployment would need a shared store instead.
"""

import time
from collections import deque
from collections.abc import Callable
from threading import Lock


class LoginThrottle:
    def __init__(
        self,
        max_failures: int,
        window_seconds: int,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._clock = clock
        self._failures: dict[tuple[str, str], deque[float]] = {}
        self._lock = Lock()

    def _recent(self, key: tuple[str, str]) -> deque[float]:
        """Failures for `key` inside the window (older ones are dropped). Hold the lock."""
        cutoff = self._clock() - self.window_seconds
        failures = self._failures.get(key, deque())
        while failures and failures[0] <= cutoff:
            failures.popleft()
        if failures:
            self._failures[key] = failures
        else:
            self._failures.pop(key, None)
        return failures

    def is_blocked(self, ip: str, username: str) -> bool:
        with self._lock:
            return len(self._recent((ip, username.lower()))) >= self.max_failures

    def record_failure(self, ip: str, username: str) -> None:
        key = (ip, username.lower())
        with self._lock:
            failures = self._recent(key)
            failures.append(self._clock())
            self._failures[key] = failures

    def reset(self, ip: str, username: str) -> None:
        with self._lock:
            self._failures.pop((ip, username.lower()), None)
