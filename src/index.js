import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './index.css';
import './ui/spinSetup';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { registerServiceWorker } from './pwa';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Telefona bildirim ve "ana ekrana ekle" için service worker (public/sw.js)
registerServiceWorker();
