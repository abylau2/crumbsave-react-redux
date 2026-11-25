import { createAsyncThunk } from '@reduxjs/toolkit';
import { getReservations, reserveBag as reserveBagRequest } from '../../services/service.js';
import { isFresh, STALE_TIME, toError } from '../cachePolicy.js';
import { fetchBags } from '../bags/bagsThunks.js';

// ---------------------------------------------------------------- list of reservations
export const fetchReservations = createAsyncThunk(
  'reservations/fetchList',
  async (arg, { signal, rejectWithValue }) => {
    try {
      return await getReservations({ signal });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      return rejectWithValue(toError(error));
    }
  },
  {
    condition: ({ force = false } = {}, { getState }) => {
      const request = getState().reservations.list;
      if (force) return true;
      if (request.status === 'loading') return false;
      return !isFresh(request, STALE_TIME.reservations);
    }
  }
);

// ---------------------------------------------------------------- business operation: reserve a bag
// Changes two things at once: the bag's quantity (bags slice) and the
// reservation list (this slice). Both listen to reserveBag.fulfilled, and both
// lists are then refreshed so the catalog, dashboard and reservations agree.
export const reserveBag = createAsyncThunk(
  'reservations/reserve',
  async (bagId, { dispatch, rejectWithValue }) => {
    let result;
    try {
      result = await reserveBagRequest(bagId);
    } catch (error) {
      return rejectWithValue(toError(error));
    }
    dispatch(fetchBags({ force: true }));
    dispatch(fetchReservations({ force: true }));
    return result; // { bag, reservation }
  },
  {
    // A second click while the first reservation is running does nothing.
    condition: (bagId, { getState }) => getState().reservations.reserving[bagId] !== 'pending'
  }
);
