import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import App from './app';

function renderApp() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = renderApp();
    expect(baseElement).toBeTruthy();
  });

  it('renders no protected content for unauthenticated visitors', () => {
    // operator-app has no login page of its own (see ProtectedRoute.tsx) —
    // an unauthenticated visitor gets a real page navigation to
    // client-portal's /login instead, which jsdom can't follow in this
    // test. What we CAN assert here is the negative: none of the
    // authenticated app shell renders in the meantime.
    const { queryByText } = renderApp();
    expect(queryByText('Все тикеты')).toBeNull();
  });
});
