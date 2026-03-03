import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit';

import { guestAuthApi } from '@/api';
import { hideLoading, showLoading } from './loadingSlice';

export const guestRegister = createAsyncThunk(
  'guestAuth/guestRegister',
  async (submitData, { dispatch, rejectWithValue }) => {
    dispatch(showLoading());
    try {
      const { user, session } = await guestAuthApi.register(submitData);
      if (!session) {
        // 沒有 session = 需要驗證信箱，不能當成已登入
        return rejectWithValue({ code: 'email_not_confirmed', message: '請先到信箱完成驗證' });
      }
      return {
        id: user.id,
        email: user.email,
      };
    } catch (error) {
      return rejectWithValue({ code: error.code, message: error.message });
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
      return rejectWithValue({ code: error.code, message: error.message });
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
    return rejectWithValue({ code: error.code, message: error.message });
  }
});

export const guestAuthSlice = createSlice({
  name: 'guestAuth',
  initialState: {
    isAuth: false,
    user: null,
    isAuthChecked: false,
    isManualLogout: false, // 是否手動登出
  },
  reducers: {
    guestLogout: state => {
      state.isAuth = false;
      state.user = null;
      state.isManualLogout = true; // 標記為手動登出
    },
    resetManualLogout: state => {
      state.isManualLogout = false;
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
      })
      .addMatcher(isAnyOf(guestRegister.fulfilled, guestLogin.fulfilled), (state, action) => {
        state.isAuth = true;
        state.user = action.payload;
      })
      .addMatcher(isAnyOf(guestRegister.rejected, guestLogin.rejected), state => {
        state.isAuth = false;
        state.user = null;
      });
  },
});

export default guestAuthSlice.reducer;

export const { guestLogout, resetManualLogout } = guestAuthSlice.actions;
