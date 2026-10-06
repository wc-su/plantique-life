import 'assets/scss/main.scss';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router';

import { supabaseGuest } from './api/clients/guestClient.js';
import setupAxiosInterceptors from './api/setup';
import Loading from './components/Loading.jsx';
import createAppHashRouter from './router/index';
import { resetCart } from './slice/cartSlice.js';
import { authCleared } from './slice/guestAuthSlice.js';
import store from './store';

setupAxiosInterceptors(store);

const router = createAppHashRouter();

supabaseGuest.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') {
    store.dispatch(authCleared());
    store.dispatch(resetCart());
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <Toaster />
      <RouterProvider router={router} />
      <Loading />
    </Provider>
  </StrictMode>,
);
