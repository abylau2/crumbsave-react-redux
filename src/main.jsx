import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { AuthProvider } from './context/AuthContext.jsx';
import { store } from './app/store.js';
import App from './App.jsx';
import { registerServiceWorker } from './pwa/registerSW.js';
import './styles/index.css';

// GitHub Pages serves 404.html for direct nested URLs. Its fallback passes the
// original route through a query parameter, then we restore it before mounting.
const fallbackRoute = new URLSearchParams(window.location.search).get('__route');
if (fallbackRoute?.startsWith('/') && !fallbackRoute.startsWith('//')) {
  window.history.replaceState(null, '', `${import.meta.env.BASE_URL.replace(/\/$/, '')}${fallbackRoute}`);
}

createRoot(document.getElementById('root')).render(<React.StrictMode><Provider store={store}><BrowserRouter basename={import.meta.env.BASE_URL}><AuthProvider><App /></AuthProvider></BrowserRouter></Provider></React.StrictMode>);


registerServiceWorker();
