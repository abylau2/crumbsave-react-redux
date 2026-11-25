import { createEntityAdapter } from '@reduxjs/toolkit';

// Bags are stored once, by id ({ ids: [], entities: { id: bag } }).
// The catalog list and the details page read the same entity, so no bag is
// ever duplicated in the store.
export const bagsAdapter = createEntityAdapter();
