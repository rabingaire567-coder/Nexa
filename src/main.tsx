import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/base.css';

const root = document.getElementById('root');

// Opt into scroll-reveal only when the browser can actually un-hide elements.
// Without this class the `.reveal` sections stay fully visible, so a failed
// bundle never leaves the page blank.
if (typeof IntersectionObserver !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('motion-ready');
}

if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  console.error('[Nexa] Missing #root element — check index.html.');
}