import { createSlice } from '@reduxjs/toolkit';
import { bagsAdapter } from './bagsAdapter.js';
import { createBag, fetchBagById, fetchBags } from './bagsThunks.js';
import { reserveBag } from '../reservations/reservationsThunks.js';
import { initialRequestState } from '../cachePolicy.js';

const initialState = bagsAdapter.getInitialState({
  list: { ...initialRequestState },                  // the catalog request
  details: {},                                       // { [id]: request state of one bag }
  create: { status: 'idle', error: null }            // the "create bag" mutation
});

const bagsSlice = createSlice({
  name: 'bags',
  initialState,
  reducers: {
    // Marks loaded data as outdated; the next read refetches it.
    bagsInvalidated(state) {
      state.list.stale = true;
      for (const detail of Object.values(state.details)) detail.stale = true;
    }
  },
  extraReducers: (builder) => {
    builder
      // ------------------------------------------------ list
      .addCase(fetchBags.pending, (state, action) => {
        state.list.status = 'loading';
        state.list.requestId = action.meta.requestId; // the newest request wins
      })
      .addCase(fetchBags.fulfilled, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) return; // stale answer
        bagsAdapter.setAll(state, action.payload);
        state.list = { ...state.list, status: 'succeeded', error: null, fetchedAt: Date.now(), stale: false, requestId: null };
      })
      .addCase(fetchBags.rejected, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) return;
        state.list.requestId = null;
        if (action.meta.aborted) {
          state.list.status = state.list.fetchedAt ? 'succeeded' : 'idle';
          return;
        }
        state.list.status = 'failed';
        state.list.error = action.payload ?? { message: action.error.message, code: 'UNKNOWN' };
      })
      // ------------------------------------------------ details
      .addCase(fetchBagById.pending, (state, action) => {
        const { id } = action.meta.arg;
        state.details[id] = { ...initialRequestState, ...state.details[id], status: 'loading', requestId: action.meta.requestId };
      })
      .addCase(fetchBagById.fulfilled, (state, action) => {
        const { id } = action.meta.arg;
        const detail = state.details[id];
        if (!detail || detail.requestId !== action.meta.requestId) return;
        if (action.payload) bagsAdapter.upsertOne(state, action.payload);
        else bagsAdapter.removeOne(state, id);
        state.details[id] = { ...detail, status: 'succeeded', error: null, fetchedAt: Date.now(), stale: false, requestId: null, notFound: !action.payload };
      })
      .addCase(fetchBagById.rejected, (state, action) => {
        const { id } = action.meta.arg;
        const detail = state.details[id];
        if (!detail || detail.requestId !== action.meta.requestId) return;
        detail.requestId = null;
        if (action.meta.aborted) {
          detail.status = detail.fetchedAt ? 'succeeded' : 'idle';
          return;
        }
        detail.status = 'failed';
        detail.error = action.payload ?? { message: action.error.message, code: 'UNKNOWN' };
      })
      // ------------------------------------------------ create
      .addCase(createBag.pending, (state) => {
        state.create = { status: 'loading', error: null };
      })
      .addCase(createBag.fulfilled, (state, action) => {
        state.create = { status: 'succeeded', error: null };
        bagsAdapter.addOne(state, action.payload);
        state.list.stale = true;
      })
      .addCase(createBag.rejected, (state, action) => {
        if (action.meta.condition) return; // skipped double submit
        state.create = { status: 'failed', error: action.payload ?? { message: action.error.message, code: 'UNKNOWN' } };
      })
      // ------------------------------------------------ reservation changed a bag
      .addCase(reserveBag.fulfilled, (state, action) => {
        bagsAdapter.upsertOne(state, action.payload.bag);
        state.list.stale = true;
      });
  }
});

export const { bagsInvalidated } = bagsSlice.actions;
export default bagsSlice.reducer;
