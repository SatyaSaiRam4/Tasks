"""A small in-process sliding-window rate limiter.

The API runs as a single process, so in-memory counters are enough; if it is
ever scaled out, swap this for a Redis-backed limiter with the same interface.
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

_lock = threading.Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)


def hit(key: str, limit: int, window_seconds: int) -> None:
    """Records one attempt for `key`; raises 429 if `limit` is exceeded within the window."""
    now = time.monotonic()
    with _lock:
        bucket = _hits[key]
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = int(window_seconds - (now - bucket[0])) + 1
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many attempts. Please wait a moment and try again.",
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def reset_all() -> None:
    """Test helper."""
    with _lock:
        _hits.clear()
