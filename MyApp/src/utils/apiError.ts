import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';

interface BackendErrorBody {
  error?: {
    code?: string;
    message?: string;
    request_id?: string | null;
  };
  // FastAPI's own shape for request-validation failures (422s raised by
  // Pydantic), distinct from this app's `{ error: { message } }` envelope.
  detail?: string | Array<{ msg?: string; loc?: Array<string | number> }>;
}

function messageFromFastApiDetail(detail: BackendErrorBody['detail']): string | null {
  if (!detail) return null;
  if (typeof detail === 'string') return detail;
  const messages = detail.map(item => (item.msg ?? '').replace(/^Value error,\s*/, '')).filter(Boolean);
  return messages.length > 0 ? messages.join(' ') : null;
}

function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === 'object' && error !== null && 'status' in error;
}

function isSerializedError(error: unknown): error is SerializedError {
  return typeof error === 'object' && error !== null && 'message' in error;
}

/**
 * Extracts a human-readable message from an RTK Query error, preferring the
 * backend's `{ error: { message } }` envelope over generic fetch errors.
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!error) return fallback;

  if (isFetchBaseQueryError(error)) {
    const data = error.data as BackendErrorBody | undefined;
    if (data?.error?.message) return data.error.message;
    const detailMessage = messageFromFastApiDetail(data?.detail);
    if (detailMessage) return detailMessage;

    if (error.status === 'FETCH_ERROR') {
      return "Can't reach Memo right now. Check your connection and try again.";
    }
    if (error.status === 'TIMEOUT_ERROR') {
      return 'The request timed out. Please try again.';
    }
    if (error.status === 'PARSING_ERROR') {
      return 'Received an unexpected response from the server.';
    }
    if (error.status === 429) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (typeof error.status === 'number' && error.status >= 500) {
      return 'Something went wrong on our side. Please try again in a moment.';
    }
    if (typeof error.status === 'number') {
      return fallback;
    }
  }

  if (isSerializedError(error) && error.message) {
    return error.message;
  }

  return fallback;
}

/** HTTP status of an RTK Query error, if any. */
export function errorStatus(error: unknown): number | null {
  return isFetchBaseQueryError(error) && typeof error.status === 'number' ? error.status : null;
}
