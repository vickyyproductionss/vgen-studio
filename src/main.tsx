import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Intercept fetch to inject auth header for API requests
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  try {
    let url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input && typeof input === 'object' && 'url' in input) {
      url = (input as any).url || '';
    }

    if (url.includes('/api/')) {
      const token = localStorage.getItem('vgen_token');
      if (token) {
        init = init || {};
        let headers: any = init.headers || {};
        if (headers instanceof Headers) {
          headers.set('Authorization', `Bearer ${token}`);
        } else if (Array.isArray(headers)) {
          const hasAuth = headers.some(([k]) => k.toLowerCase() === 'authorization');
          if (!hasAuth) {
            headers.push(['Authorization', `Bearer ${token}`]);
          }
        } else if (typeof headers === 'object') {
          if (!headers['Authorization'] && !headers['authorization']) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }
        init.headers = headers;
      }
    }
  } catch (err) {
    console.error('[Fetch Interceptor Error]', err);
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
