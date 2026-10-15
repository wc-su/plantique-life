import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit';

import { guestAuthApi } from '@/api';
import { getAuthErrorMessage } from '@/utils/errorMessage';
import { hideLoading, showLoading } from './loadingSlice';

export const guestRegister = createAsyncThunk(
  'guestAuth/guestRegister',
  async (submitData, { dispatch, rejectWithValue }) => {
    dispatch(showLoading());
    try {
      const { user, session } = await guestAuthApi.register(submitData);
      if (!session) {
        // 沒有 session = 需要驗證信箱，不能當成已登入
        const errCode = 'email_not_confirmed';
        return rejectWithValue({ code: errCode, message: getAuthErrorMessage(errCode) });
      }
      return {
        id: user.id,
        email: user.email,
      };
    } catch (error) {
      return rejectWithValue({ code: error.code, message: getAuthErrorMessage(error.code) });
    } finally {
      dispatch(hideLoading());
    }
  },
);

export const guestLogin = createAsyncThunk(
  'guestAuth/guestLogin',
  async (submitData, { dispatch, rejectWithValue }) => {
    dispatch(showLoading());
    try {
      const { user } = await guestAuthApi.login(submitData);
      return {
        id: user.id,
        email: user.email,
      };
    } catch (error) {
      return rejectWithValue({ code: error.code, message: getAuthErrorMessage(error.code) });
    } finally {
      dispatch(hideLoading());
    }
  },
);

export const guestAuthCheck = createAsyncThunk('guestAuth/guestAuthCheck', async (_, { rejectWithValue }) => {
  try {
    const { session } = await guestAuthApi.check();
    return session ? { id: session.user.id, email: session.user.email } : null;
  } catch (error) {
    return rejectWithValue({ code: error.code, message: getAuthErrorMessage(error.code) });
  }
});

// 登出：只負責呼叫 guestAuthApi.logout()、顯示 loading、回傳錯誤，所以沒有 extraReducers
// 登入狀態由 main.jsx 的 SIGNED_OUT 監聽清除（logout 成功時 Supabase 會發出）
// 因為其他分頁登出、session 過期也會觸發 SIGNED_OUT，統一在監聽處理才能涵蓋所有情況
export const guestAuthLogout = createAsyncThunk(
  'guestAuth/guestAuthLogout',
  async (_, { dispatch, rejectWithValue }) => {
    dispatch(showLoading());
    try {
      await guestAuthApi.logout();
    } catch (error) {
      return rejectWithValue({ code: error.code, message: getAuthErrorMessage(error.code) });
    } finally {
      dispatch(hideLoading());
    }
  },
);

export const guestAuthSlice = createSlice({
  name: 'guestAuth',
  initialState: {
    isAuth: false,
    user: null,
    isAuthChecked: false,
    isSigningIn: false, // 是否正在登入中
  },
  reducers: {
    authCleared: state => {
      state.isAuth = false;
      state.user = null;
    },
    authSynced: (state, action) => {
      state.isAuth = true;
      state.user = action.payload;
      state.isAuthChecked = true;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(guestAuthCheck.pending, state => {
        state.isAuth = false;
        state.isAuthChecked = false;
      })
      .addCase(guestAuthCheck.fulfilled, (state, action) => {
        state.isAuth = !!action.payload; // null: false，有資料: true
        state.user = action.payload;
        state.isAuthChecked = true;
      })
      .addCase(guestAuthCheck.rejected, state => {
        state.isAuth = false;
        state.user = null;
        state.isAuthChecked = true;
      })
      .addMatcher(isAnyOf(guestRegister.pending, guestLogin.pending), state => {
        state.isAuth = false;
        state.isSigningIn = true;
      })
      .addMatcher(isAnyOf(guestRegister.fulfilled, guestLogin.fulfilled), (state, action) => {
        state.isAuth = true;
        state.user = action.payload;
        // 已登入完成，清除註記
        state.isSigningIn = false;
      })
      .addMatcher(isAnyOf(guestRegister.rejected, guestLogin.rejected), state => {
        state.isAuth = false;
        state.user = null;
        state.isSigningIn = false;
      });
  },
});

export default guestAuthSlice.reducer;

export const { authCleared, authSynced } = guestAuthSlice.actions;
