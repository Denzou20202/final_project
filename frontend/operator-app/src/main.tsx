import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
// Side-effect import — initializes i18next before anything renders.
import './i18n.js';
import { queryClient } from './lib/query-client.js';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

// Matches the `base: '/staff/'` set unconditionally in vite.config.mts —
// this app always lives under /staff/, dev included.
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/staff">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
