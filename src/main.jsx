import 'assets/scss/main.scss';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router';

import { supabaseGuest } from './api/clients/guestClient.js';
import { GUEST_AUTH_STORAGE_KEY } from './api/core/constants.js';
import setupAxiosInterceptors from './api/setup';
import Loading from './components/Loading.jsx';
import createAppHashRouter from './router/index';
import { authAwareInitCarts, resetCart, syncCartsAfterOtherTabSignIn } from './slice/cartSlice.js';
import { authCleared, authSynced } from './slice/guestAuthSlice.js';
import { closeModal } from './slice/uiSlice.js';
import store from './store';

setupAxiosInterceptors(store);

const router = createAppHashRouter();

supabaseGuest.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') {
    store.dispatch(authCleared());
    store.dispatch(resetCart());
    store.dispatch(authAwareInitCarts()).catch(error => toast.error(error.message));
  }
});

// 其他分頁修改 localStorage 時觸發（自己寫入不會觸發），用來同步訪客購物車
window.addEventListener('storage', event => {
  // 不是訪客購物車的 localStorage 不處理 (Supabase 的 session 也存在 localStorage，也會觸發)
  if (event.key !== 'guestCarts') return;

  // 已登入：購物車在遠端，不用 localStorage 的資料
  if (store.getState().guestAuth.isAuth) return;

  // 重新讀取 localStorage，和商品資料合併後取代這個分頁的購物車
  store.dispatch(authAwareInitCarts()).catch(error => toast.error(error.message));
});

// 其他分頁登入：等 session 同步到這個分頁的 localStorage 後才處理
// （BroadcastChannel 的 SIGNED_IN 可能比 localStorage 早到，那時呼叫 Supabase 會用 anon key 送出）
window.addEventListener('storage', async event => {
  if (event.key !== GUEST_AUTH_STORAGE_KEY || !event.newValue) return;

  const { data } = await supabaseGuest.auth.getSession();
  const session = data.session;
  if (!session) return;

  // 同一個帳號，已經登入了（其他分頁 refresh token 也會寫入，也會觸發）
  const { isAuth, user } = store.getState().guestAuth;
  if (isAuth && user?.id === session.user.id) return;

  // 其他分頁登入 → 同步 auth、購物車資訊
  store.dispatch(authSynced({ id: session.user.id, email: session.user.email }));
  // 購物車抓完再關視窗：從「去結帳」、「立即購買」打開的視窗，關閉後會跳到購物車頁，要先有購物車資料
  store
    .dispatch(syncCartsAfterOtherTabSignIn())
    .then(({ buyNowFailed }) => {
      if (buyNowFailed) toast.error('立即購買的商品加入購物車失敗');
    })
    .catch(error => toast.error(error.message))
    .finally(() => store.dispatch(closeModal()));
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
