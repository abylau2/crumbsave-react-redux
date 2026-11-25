import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { fetchReservations, reserveBag } from './reservationsThunks.js';
import { initialRequestState } from '../cachePolicy.js';

// Newest reservation first.
export const reservationsAdapter = createEntityAdapter({
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt)
});

const initialState = reservationsAdapter.getInitialState({
  list: { ...initialRequestState },
  reserving: {},   // { [bagId]: 'pending' } — guards against double submits
  lastError: null  // { bagId, message, code } of the last failed reservation
});

const reservationsSlice = createSlice({
  name: 'reservations',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchReservations.pending, (state, action) => {
        state.list.status = 'loading';
        state.list.requestId = action.meta.requestId;
      })
      .addCase(fetchReservations.fulfilled, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) return;
        reservationsAdapter.setAll(state, action.payload);
        state.list = { ...state.list, status: 'succeeded', error: null, fetchedAt: Date.now(), stale: false, requestId: null };
      })
      .addCase(fetchReservations.rejected, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) return;
        state.list.requestId = null;
        if (action.meta.aborted) {
          state.list.status = state.list.fetchedAt ? 'succeeded' : 'idle';
          return;
        }
        state.list.status = 'failed';
        state.list.error = action.payload ?? { message: action.error.message, code: 'UNKNOWN' };
      })
      .addCase(reserveBag.pending, (state, action) => {
        state.reserving[action.meta.arg] = 'pending';
        state.lastError = null;
      })
      .addCase(reserveBag.fulfilled, (state, action) => {
        delete state.reserving[action.meta.arg];
        reservationsAdapter.upsertOne(state, action.payload.reservation);
        state.list.stale = true;
      })
      .addCase(reserveBag.rejected, (state, action) => {
        delete state.reserving[action.meta.arg];
        state.lastError = { bagId: action.meta.arg, ...(action.payload ?? { message: action.error.message, code: 'UNKNOWN' }) };
      });
  }
});

export default reservationsSlice.reducer;
