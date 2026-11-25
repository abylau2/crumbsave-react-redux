// How long loaded data counts as fresh (milliseconds). Same timings as the
// TanStack Query setup from Homework 6, now enforced by the thunks' `condition`.
export const STALE_TIME = {
  bags: 60_000,         // catalog list: fresh for 1 minute
  bag: 60_000,          // one bag: fresh for 1 minute
  reservations: 30_000  // reservations: fresh for 30 seconds
};

// Shape used for every remote resource in the store.
export const initialRequestState = {
  status: 'idle',   // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,      // { message, code } of the last failure
  fetchedAt: 0,     // when data last arrived (0 = never)
  stale: false,     // set by a mutation: the next read must refetch
  requestId: null   // id of the newest request; older answers are ignored
};

// True when the data exists, was not invalidated and is younger than `maxAge`.
export function isFresh(request, maxAge, now = Date.now()) {
  return Boolean(request)
    && request.status === 'succeeded'
    && !request.stale
    && now - request.fetchedAt < maxAge;
}

// Errors must be plain objects to live in the store.
export function toError(error) {
  return { message: error?.message || 'Something went wrong. Please try again.', code: error?.code || 'UNKNOWN' };
}
