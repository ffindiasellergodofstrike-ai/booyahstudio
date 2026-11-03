import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import GarenaCheckout from '../../src/pages/booyahpay';

function initPrivateCheckout() {
  let initialSearch = '';
  try {
    const checkoutData = (window as any).__CHECKOUT__;
    delete (window as any).__CHECKOUT__;
    if (checkoutData && typeof checkoutData === 'object') {
      const sp = new URLSearchParams(checkoutData);
      initialSearch = '?' + sp.toString();
    } else if (window.location.search) {
      initialSearch = window.location.search;
    }
  } catch {
    initialSearch = window.location.search || '';
  }

  const container = document.getElementById('private-checkout-root');
  if (!container) return;

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[{ pathname: '/booyahpay', search: initialSearch }]}>
        <GarenaCheckout />
      </MemoryRouter>
    </React.StrictMode>
  );
}

initPrivateCheckout();
