import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { Outlet, useNavigate } from 'react-router';

import { openModal } from '@/slice/uiSlice';

const RequireGuestAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { isAuth, isAuthChecked } = useSelector(state => state.guestAuth);

  const prevIsAuthRef = useRef(undefined);

  // Navbar 會做驗證，這裡只等待驗證結果
  useEffect(() => {
    if (!isAuthChecked) return;

    if (!isAuth) {
      navigate('/');
      // 只有「剛進入頁面時沒登入」才提示（例如未登入直接輸入網址，prevIsAuthRef.current 是 undefined）
      // 登入後登出（自己按登出、其他分頁登出、session 過期）都只導回首頁，不提示
      if (!prevIsAuthRef.current) {
        toast.error('請先登入');
        dispatch(openModal('login'));
      }
    }

    prevIsAuthRef.current = isAuth;
  }, [isAuth, isAuthChecked, dispatch, navigate]);

  // 避免非同步的時間差，導致非預期的渲染結果
  if (!isAuthChecked) return null;

  // 驗證結束，沒登入
  if (!isAuth) return null;

  // 驗證結束，有登入
  return <Outlet />;
};

export default RequireGuestAuth;
