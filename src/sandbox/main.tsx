/// <reference types="vite/client" />
// Development-only entry for the navigation sandbox (sandbox.html). Not part of production builds.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/app.css';
import { App } from '../ui/App';
import { SANDBOX_LEVEL } from './level';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App levels={[SANDBOX_LEVEL]} />
  </StrictMode>,
);
