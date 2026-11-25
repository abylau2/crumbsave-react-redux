# CrumbSave

CrumbSave is my React project for the university course. It is a demo website where people can look at "surprise bags" with cheap leftover food in Almaty. The shops and the bags are not real, and you cannot pay or pick up anything.

Deployed site: https://abylau2.github.io/crumbsave-react-redux/

This is homework 8. I moved the global state and all data loading of my homework 7 project (Firebase login, caching, installable PWA with offline mode) to **Redux Toolkit**. All features from the earlier homeworks are still there: login, protected routes, CRUD, search, filters, sorting, pagination, PWA and offline mode.

GitHub: https://github.com/abylau2/crumbsave-react-redux

## What the app can do

- Look at the list of bags, search them, filter them, sort them and go through pages
- Open one bag and reserve it
- Add a new bag with a form
- See my reservations
- Sign up and log in with email and password, or with Google
- Profile page (only for logged in users) with email and UID
- Log out
- Install the app on a phone or computer, and use it without internet
- Small animations (cards appear one by one, hover effect, reserve button). They are turned off if the system has "reduce motion" on

The navigation bar changes: when you are logged out you see Login and Signup, when you are logged in you see Profile and Logout.

## How to run it

You need Node.js and npm.

```bash
npm install
npm run dev
```

Other commands:

```bash
npm run build    # build the project
npm test         # run the tests
```

## Environment variables and Firebase

The Firebase settings are in environment variables. They start with `VITE_`, because Vite only shows these to the app.

1. Make a project in the Firebase console and add a Web app.
2. In Authentication, turn on Email/Password and Google.
3. Copy `.env.example` to a new file called `.env.local` and write your values there:

```bash
cp .env.example .env.local
```

| Variable | Where to find it in Firebase |
|---|---|
| VITE_FIREBASE_API_KEY | apiKey |
| VITE_FIREBASE_AUTH_DOMAIN | authDomain |
| VITE_FIREBASE_PROJECT_ID | projectId |
| VITE_FIREBASE_STORAGE_BUCKET | storageBucket |
| VITE_FIREBASE_MESSAGING_SENDER_ID | messagingSenderId |
| VITE_FIREBASE_APP_ID | appId |

4. Restart `npm run dev`.

`.env.local` is in `.gitignore`, so it is not on GitHub. `.env.example` is on GitHub and shows which variables are needed. If the variables are missing, the app does not crash. The login pages just show a message that Firebase is not set up.

For the deployed site I also added `abylau2.github.io` in Firebase, Authentication, Settings, Authorized domains. Without this, Google login does not work.

## How login works

- `src/firebase.js` starts Firebase with the environment variables.
- `src/services/authService.js` has all the Firebase login functions (sign up, log in, Google, log out). Only this file talks to Firebase Auth.
- `src/context/AuthContext.jsx` has `AuthProvider` and the `useAuth` hook. It uses `onAuthStateChanged` to know if a user is logged in. It also keeps `loading` and `error`.
- The session stays after a page refresh. On the login page there is a "Keep me signed in" checkbox. If it is on, the login is saved in the browser. If it is off, the user is logged out when the tab is closed.
- `src/components/ProtectedRoute.jsx` sends a user who is not logged in to `/login`. After the login the user goes back to the page he wanted.

## Redux Toolkit (homework 8)

Before this homework the server data lived in TanStack Query. Now all shared state is in one Redux store and TanStack Query is removed, so the same data is never kept in two places.

### Store

`src/app/store.js` creates the store with `configureStore` and three reducers. `src/main.jsx` wraps the app in `<Provider store={store}>`.

```js
configureStore({ reducer: { bags, reservations, network } })
```

### Folders

```text
src/app/store.js                      configureStore, refresh on focus / reconnect
src/features/cachePolicy.js           fresh times (60 s / 30 s), request state shape
src/features/bags/                    bagsSlice, bagsThunks, bagsSelectors, bagsAdapter
src/features/reservations/            reservationsSlice, reservationsThunks, reservationsSelectors
src/features/network/networkSlice.js  online / offline and "showing saved data"
src/services/                         API calls only (no Redux inside)
src/hooks/                            useBags, useBag, useReservations, useBagMutations, useDebouncedValue
src/pages, src/components             UI only: they use the hooks, useSelector and useDispatch
```

Redux logic, API services, hooks and UI are separate: the slices never call `fetch` or `localStorage` directly, they only call the thunks, and the thunks call `services/service.js`.

### Slices

| Slice | What it keeps | Why it is global |
|---|---|---|
| `bags` | every bag once, by id (`createEntityAdapter`), plus the request state of the list, of each bag and of "create bag" | the home page, catalog, details page and dashboard all use the same bags |
| `reservations` | reservations by id, the list request state, which bag is being reserved now, last reservation error | the details page and the reservations page must agree |
| `network` | `online`, `savedData`, `savedAt` | the header pill, the offline banner, the `/offline` page and the API service all use it |

What I kept **out** of Redux on purpose:

- Login stays in `AuthContext` (Firebase already keeps the user; the homework allows this).
- Temporary UI state stays local with `useState`: form fields and form errors, the text in the search box while typing, the dashboard filters, the open mobile menu, the message under the reserve button.
- Catalog filters, sort and page stay in the **URL** (`?q=&category=&sort=&page=`), so links and the Back button keep working. The URL is the only place for them, so they are not copied into Redux.

### Thunks (`createAsyncThunk`)

| Thunk | Kind | What it does |
|---|---|---|
| `fetchBags({ force })` | list fetching | loads the catalog (`bags/fetchList`) |
| `fetchBagById({ id, force })` | details fetching | loads one bag (`bags/fetchDetails`) and puts it into the same entity table |
| `createBag(values)` | mutation | adds a new bag (`bags/create`), then refreshes the list |
| `fetchReservations({ force })` | list fetching | loads the reservations |
| `reserveBag(bagId)` | business operation | reserves a bag: the bag's quantity goes down **and** a reservation is added, then both lists are refreshed |

Every thunk is handled in `extraReducers` with `pending`, `fulfilled` and `rejected`:

- `pending`: status `loading`, and the request id is saved.
- `fulfilled`: the data is saved (`setAll`, `upsertOne`, `addOne`), status `succeeded`, time saved in `fetchedAt`.
- `rejected`: status `failed` and the error is saved as a plain object `{ message, code }` (`rejectWithValue`).

### Loading, errors, empty results, retries, old requests

- **Loading:** skeletons while there is no data yet. Data that was loaded once stays on screen while it refreshes.
- **Errors:** an error message with a **Try again** button. The button dispatches the thunk with `{ force: true }` (retry). If a refresh fails but old data exists, the old data stays visible.
- **Empty results:** the catalog, dashboard and reservations show an empty message.
- **No unnecessary requests:** each thunk has a `condition`. It cancels the request before it starts if the same request is already running, or if the data is still fresh (catalog and one bag: 60 s, reservations: 30 s). The details page does not even send a request if the fresh catalog already has this bag. So Home → Catalog → Dashboard → a bag sends **one** catalog request.
- **Old (stale) requests:** `pending` saves `meta.requestId`. `fulfilled` and `rejected` are ignored if they belong to an older request, so a slow old answer can never replace newer data.
- **Refresh after mutations:** `createBag` and `reserveBag` update the store at once, mark the lists as stale and start `fetchBags({ force: true })` / `fetchReservations({ force: true })`.
- **Refresh on focus and reconnect:** `store.js` re-runs the list thunks when the tab becomes visible or the internet comes back; `condition` skips them if the data is still fresh.

### Selectors

All selectors are in `bagsSelectors.js` and `reservationsSelectors.js` and are reused by several pages.

| Selector | Memoized | Used by |
|---|---|---|
| `selectAllBags`, `selectBagById` | yes (entity adapter) | hooks, details page |
| `selectBagsStatus`, `selectReservationsStatus` | — | all pages with data |
| `selectFilteredBags(state, filters)` | `createSelector` | catalog |
| `selectCatalogPage(state, filters)` | `createSelector` | catalog (filtered + current page) |
| `selectFeaturedBags` | `createSelector` | home page |
| `selectDashboard(state, category, district)` | `createSelector` | dashboard numbers |
| `selectDashboardOptions` | `createSelector` | dashboard dropdowns |
| `selectReservedBagIds`, `selectIsBagReserved` | `createSelector` | details page ("Already reserved") |

`createSelector` remembers the last result. With the same bags and the same filters it returns the very same array, so the list is not filtered and sorted again and the page does not re-render.

### Search debounce

The search box updates on every key press (local state), and the URL `?q=` is updated 300 ms after the user stops typing (`useDebouncedValue`). Filters, sorting and pagination still come from the URL.

## Pages

| Route | What it is |
|---|---|
| `/` | Home page. It has the About section: the About link in the header scrolls to it |
| `/about` | About the project |
| `/bags` | Catalog with filters and pages |
| `/bags/:id` | One bag, reserve button |
| `/add` | Form for a new bag |
| `/reservations` | My reservations |
| `/dashboard` | Numbers about the bags |
| `/login` | Login |
| `/signup` | Sign up |
| `/profile` | Profile (protected) |
| `/offline` | Offline page with Retry Connection (also pre-cached as `offline.html`) |
| `*` | 404 page |

## Project folders

```text
public/          manifest, icons, offline.html, fonts, images
sw/              service worker template
scripts/         build scripts (API files, service worker)
src/
  components/    small parts of the pages, ProtectedRoute
  context/       AuthContext
  app/           Redux store (configureStore)
  features/      Redux slices, thunks and selectors
  hooks/         hooks that use useSelector / useDispatch
  lib/           network status helpers (write to the network slice)
  pwa/           service worker registration and install button logic
  pages/         one file for each page
  services/      service.js (fake API with localStorage) and authService.js (Firebase)
  utils/         validation and helper functions
  firebase.js    Firebase setup
tests/           tests
```

The pages do not use `localStorage` or `fetch` by themselves. Pages use hooks, hooks dispatch thunks and read selectors, and thunks use the services.

## Fake API

There is no real server, so the API has two parts:

- **Public catalog (over the network).** Before every build, `scripts/generate-api.mjs` writes the catalog as JSON files: `api/bags.json` (the list) and `api/bags/<id>.json` (one bag). The app loads them with `fetch`. This is the data that the service worker caches.
- **Personal data (in the browser).** `src/services/service.js` waits about 450 ms and keeps stock, reservations and the bags you add in `localStorage`. They stay after a refresh, but only in the same browser, and they work offline.

When the catalog is loaded, public fields (title, price, picture, ...) come from the JSON file and the quantity comes from `localStorage`. If the request fails, the app uses the saved copy and shows a message. It does not crash.

## PWA and offline mode

### Install

`public/manifest.webmanifest` has the name, short name, `start_url`, `scope`, `display: standalone`, theme and background colors and icons (192, 512 and a maskable one). The manifest is linked in `index.html`. All paths in it are relative, so it works under `/crumbsave-react-redux/`. In Chrome or Edge use the install icon in the address bar, or the "Install app" link in the menu.

### Service worker

I wrote it by hand (no Workbox). The template is `sw/sw.template.js`. After `vite build`, `scripts/build-sw.mjs` lists the built files and writes `sw.js` with a version that is a hash of those files. When any file changes, the version changes, and browsers install the new worker.

| Event | What it does |
| --- | --- |
| `install` | Downloads the app shell into the cache `csredux-precache-<version>`: index.html, built JS and CSS, fonts, icons, manifest and `offline.html`. It does **not** skip waiting. |
| `activate` | Deletes every `crumbsave-*` cache that is not current, then takes control of the open tabs. |
| `fetch` | Chooses a strategy (see below). Only same-origin `GET` requests are handled. |

### Caching strategies

| What | Strategy | Cache | Limit |
| --- | --- | --- | --- |
| Built JS, CSS, fonts, icons | Pre-cache, then cache-first | `csredux-precache-<version>` | whole shell, replaced on update |
| Images, icons, fonts seen later | **Cache-first** | `csredux-static-v1` | 80 files, oldest are deleted |
| `api/bags.json`, `api/bags/<id>.json` | **Network-first** (4 s timeout, then saved copy) | `csredux-api-v1` | 60 files, saved answers older than 7 days are not used |
| Page navigation to an app route (`/`, `/bags`, `/bags/5`, ...) | App shell from the cache | precache | |
| Page navigation to an unknown address, when the network fails | `offline.html` | precache | |

The cache names start with `csredux-` because my homework 7 site is on the same domain (`abylau2.github.io`). Each service worker only deletes its own old caches, so the two sites do not delete each other's caches.

When a saved API answer is used, the worker adds the headers `x-crumbsave-source: cache` and `x-crumbsave-cached-at`. The app reads them and shows the banner "Showing saved data".

**Privacy.** The worker ignores requests to other domains, so Firebase and Google sign-in calls (tokens, login responses) are never stored. It also ignores requests with an `Authorization` header. Reservations and your own bags are in `localStorage`, not in a shared cache.

### Updates

1. The browser checks `sw.js` when the page loads, every hour and when the tab becomes visible.
2. A new worker installs in the background and waits.
3. The app shows "A new version of CrumbSave is ready" with **Update now** and **Later**.
4. **Update now** sends `SKIP_WAITING`. The new worker activates and deletes the old caches. The page reloads once.

Nobody has to clear browser storage by hand. Login and reservations are kept.

### Offline

- `/offline` is a page in the app, with a **Retry Connection** button.
- `offline.html` is the same message as a plain file with inline styles. It is pre-cached, so it opens with no network, even when the app cannot start.
- The header has an **Online / Offline** indicator. A banner appears when you are offline or when the data on screen is a saved copy.
- `navigator.onLine` is not enough, so **Retry Connection** makes a real request to the server. The same check runs when the browser says it is back online.
- Pages you opened and bags you loaded stay available offline. When the connection returns, the data is loaded again and the banner disappears.

### Mobile

The layout works from 320 px wide, in portrait and landscape. The menu turns into a burger button below 700 px. Buttons and form fields are at least 44 px high on touch screens, fields use 16 px text so iOS does not zoom, and there is no horizontal scroll on any page.

### How to test the PWA by hand

1. `npm run build && npm run preview` and open the address.
2. Chrome DevTools, **Application** tab: check **Manifest**, **Service Workers** and **Cache Storage**.
3. Visit `/bags` and one bag, then in the **Network** tab choose **Offline** and reload. The pages still open and the banner says you are offline.
4. Open `/anything-unknown` while offline. You see the offline page.
5. Go back online and press **Retry Connection**.

## Tests

`npm test` runs the unit tests (search, filters, validation, auth errors, manifest, service worker build, and `redux.test.js` for the store, thunks, `condition`, stale requests, mutations and memoized selectors). There are also browser tests in the `tests` folder that use Python Playwright: `pwa_browser.py` (install, offline, cache limits, update flow), `mobile_browser.py` (layouts from 320 px, touch size), `auth_browser.py` (login, protected routes, CRUD) and `redux_browser.py` (one catalog request for several pages, search debounce). Run `npm run build` first. I could not test real Google login in the automatic tests, so I tested it by hand on the deployed site.

## Deploy

The site is on GitHub Pages, from the `gh-pages` branch. The command `npm run build:pages` makes the API files, the build with the right base path `/crumbsave-react-redux/`, and the service worker. The Firebase variables are put in the build when it is made, so I build it on my computer where `.env.local` is. The file `404.html` helps when someone refreshes a page like `/bags/5`.

## Images

Images and their sources are listed in [IMAGE_CREDITS.md](IMAGE_CREDITS.md). The food bags are fictional and are not official offers from any brand.
