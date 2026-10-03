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
    isManualLogout: false, // 是否手動登出
  },
  reducers: {
    resetManualLogout: state => {
      state.isManualLogout = false;
    },
    authCleared: state => {
      state.isAuth = false;
      state.user = null;
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
      // 手動登出：在 pending 就標記，不等 fulfilled
      // signOut() 會先觸發 SIGNED_OUT（main.jsx 清掉 isAuth）才回傳結果
      // 標記太晚的話，RequireGuestAuth 會誤判成 session 過期，顯示「請先登入」
      .addCase(guestAuthLogout.pending, state => {
        state.isManualLogout = true;
      })
      // 登出失敗：取消手動登出的標記
      .addCase(guestAuthLogout.rejected, state => {
        state.isManualLogout = false;
      })
      .addMatcher(isAnyOf(guestRegister.pending, guestLogin.pending), state => {
        state.isAuth = false;
      })
      .addMatcher(isAnyOf(guestRegister.fulfilled, guestLogin.fulfilled), (state, action) => {
        state.isAuth = true;
        state.user = action.payload;
        // 清掉上次手動登出的標記
        state.isManualLogout = false;
      })
      .addMatcher(isAnyOf(guestRegister.rejected, guestLogin.rejected), state => {
        state.isAuth = false;
        state.user = null;
      });
  },
});

export default guestAuthSlice.reducer;

export const { resetManualLogout, authCleared } = guestAuthSlice.actions;
