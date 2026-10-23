/// <reference types="vite/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/app.css';
import { App } from './ui/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The development preview (/dev/) says so on every screen; the published game never shows this. */}
    {__DEV_PREVIEW__ && <p className="dev-preview" role="note">Development preview</p>}
    <App />
  </StrictMode>,
);
