import { createAsyncThunk } from '@reduxjs/toolkit';
import { createBag as createBagRequest, getBagById, getBags } from '../../services/service.js';
import { isFresh, STALE_TIME, toError } from '../cachePolicy.js';
import { selectBagById } from './bagsSelectors.js';

// ---------------------------------------------------------------- 1. list fetching
// arg: { force } — force skips the freshness check (Retry button, refresh after a mutation).
export const fetchBags = createAsyncThunk(
  'bags/fetchList',
  async (arg, { signal, rejectWithValue }) => {
    try {
      return await getBags({ signal });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      return rejectWithValue(toError(error));
    }
  },
  {
    // Returning false cancels the thunk before any request is made:
    // no duplicate request while one is running, no request while data is fresh.
    condition: ({ force = false } = {}, { getState }) => {
      const request = getState().bags.list;
      if (force) return true;
      if (request.status === 'loading') return false;
      return !isFresh(request, STALE_TIME.bags);
    }
  }
);

// ---------------------------------------------------------------- 2. details fetching
// arg: { id, force }
export const fetchBagById = createAsyncThunk(
  'bags/fetchDetails',
  async ({ id }, { signal, rejectWithValue }) => {
    try {
      return await getBagById(id, { signal });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      return rejectWithValue(toError(error));
    }
  },
  {
    condition: ({ id, force = false }, { getState }) => {
      const state = getState();
      const detail = state.bags.details[id];
      if (force) return true;
      if (detail?.status === 'loading') return false;
      if (isFresh(detail, STALE_TIME.bag)) return false;
      // A fresh catalog list already contains this bag: no extra request needed.
      return !(selectBagById(state, id) && isFresh(state.bags.list, STALE_TIME.bags));
    }
  }
);

// ---------------------------------------------------------------- 3. mutation: create a bag
export const createBag = createAsyncThunk(
  'bags/create',
  async (values, { dispatch, rejectWithValue }) => {
    let bag;
    try {
      bag = await createBagRequest(values);
    } catch (error) {
      return rejectWithValue(toError(error));
    }
    // The new bag is already added by the reducer; the list is marked stale and
    // refreshed in the background so every derived view is up to date.
    dispatch(fetchBags({ force: true }));
    return bag;
  },
  { condition: (values, { getState }) => getState().bags.create.status !== 'loading' }
);
