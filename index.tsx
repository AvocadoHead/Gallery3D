import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

// FIX: Removed <React.StrictMode> to prevent R3F double-mount glitches
root.render(
  <App />
);
