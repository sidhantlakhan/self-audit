import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/mulish/latin-400.css';
import '@fontsource/mulish/latin-ext-400.css';
import '@fontsource/mulish/latin-600.css';
import '@fontsource/mulish/latin-ext-600.css';
import '@fontsource/mulish/latin-700.css';
import '@fontsource/mulish/latin-ext-700.css';
import '@fontsource/mulish/latin-800.css';
import '@fontsource/mulish/latin-ext-800.css';
import './styles.css';
import { App } from './App.tsx';
import { captureAttribution } from './lib/attribution.ts';

captureAttribution();

const root = document.getElementById('root')!;
const tree = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
// The landing page is server-rendered; hydrate it. Everything else is client-rendered.
if (root.firstElementChild) hydrateRoot(root, tree);
else createRoot(root).render(tree);
