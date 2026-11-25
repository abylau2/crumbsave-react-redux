import { createSlice } from '@reduxjs/toolkit';

// Global answer to two questions: is the network reachable, and is the screen
// showing saved (cached) data? The header pill, the offline banner, the
// /offline page and the service layer all share it.
const hasNavigator = typeof navigator !== 'undefined';

const networkSlice = createSlice({
  name: 'network',
  initialState: {
    online: hasNavigator && typeof navigator.onLine === 'boolean' ? navigator.onLine : true,
    savedData: false,
    savedAt: null
  },
  reducers: {
    onlineChanged(state, action) {
      state.online = action.payload;
    },
    // Reported after every public API request.
    dataReported(state, action) {
      const { fromSaved, savedAt = null } = action.payload;
      if (fromSaved) {
        state.savedData = true;
        state.savedAt = savedAt;
      } else {
        state.savedData = false;
        state.savedAt = null;
        state.online = true; // fresh data arrived, so the network works
      }
    }
  }
});

export const { onlineChanged, dataReported } = networkSlice.actions;
export const selectNetwork = (state) => state.network;
export const selectIsOnline = (state) => state.network.online;
export default networkSlice.reducer;
