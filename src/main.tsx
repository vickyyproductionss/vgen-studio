import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Intercept fetch to inject auth header for API requests
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input as Request).url);
  if (url.startsWith('/api/') || url.startsWith('http://localhost:8000/api/')) {
    const token = localStorage.getItem('vgen_token');
    if (token) {
      init = init || {};
      // Ensure headers is a plain object or Headers instance
      let headers: any = init.headers || {};
      if (headers instanceof Headers) {
        headers.set('Authorization', `Bearer ${token}`);
      } else if (Array.isArray(headers)) {
        const hasAuth = headers.some(([k]) => k.toLowerCase() === 'authorization');
        if (!hasAuth) {
          headers.push(['Authorization', `Bearer ${token}`]);
        }
      } else {
        if (!headers['Authorization'] && !headers['authorization']) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      init.headers = headers;
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
