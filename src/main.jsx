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
import { resetCart, syncCartsAfterOtherTabSignIn } from './slice/cartSlice.js';
import { authCleared, authSynced } from './slice/guestAuthSlice.js';
import { closeModal } from './slice/uiSlice.js';
import store from './store';

setupAxiosInterceptors(store);

const router = createAppHashRouter();

supabaseGuest.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    store.dispatch(authCleared());
    store.dispatch(resetCart());
  } else if (event === 'SIGNED_IN') {
    const { isSigningIn, isAuth, user } = store.getState().guestAuth;
    // 這個分頁正在自己登入
    if (isSigningIn) return;

    // 同一個帳號，已經登入了
    if (isAuth && user?.id === session.user.id) return;

    // 其他分頁登入 → 同步 auth、購物車資訊
    store.dispatch(authSynced({ id: session.user.id, email: session.user.email }));
    // 購物車抓完再關視窗：從「去結帳」、「立即購買」打開的視窗，關閉後會跳到購物車頁，要先有購物車資料
    store.dispatch(syncCartsAfterOtherTabSignIn()).finally(() => store.dispatch(closeModal()));
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
