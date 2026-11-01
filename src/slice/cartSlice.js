import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit';

import { getCartErrorMessage } from '@/utils/errorMessage';
import { cartApi, guestCouponApi } from '../api';
import { hideLoading, showLoading } from './loadingSlice';
import { getAllProducts, selectAllProducts } from './product/guestProductSlice';

// 取得商品列表：Redux 裡還沒有就先打 API
async function loadAllProducts(dispatch, getState) {
  let allProducts = selectAllProducts(getState());
  if (allProducts.length === 0) {
    await dispatch(getAllProducts()).unwrap();
    allProducts = selectAllProducts(getState());
  }
  return allProducts;
}

// 合併購物車品項和商品資料，回傳 { carts, total }
function mergeCartItems(items, allProducts) {
  // 用 Map 依 id 查商品，之後不用每個品項都跑一次 find
  const productMap = new Map(allProducts.map(p => [p.id, p]));

  const carts = items
    .filter(item => productMap.has(item.product_id)) // 略過比對不到的品項（已下架）
    .map(item => {
      const product = productMap.get(item.product_id);
      return { ...item, product, total: item.qty * product.price };
    });
  const total = carts.reduce((sum, item) => sum + item.total, 0);
  return { carts, total };
}

// 統一購物車的錯誤格式：axios 攔截器回傳字串，Supabase 回傳物件
function toCartError(error) {
  if (typeof error === 'string') {
    return { code: 'API_ERROR', message: getCartErrorMessage('API_ERROR'), detail: error };
  }
  // supabase-js 網路失敗時 code 是空字串
  const code = error.code === '' ? 'NETWORK_ERROR' : error.code;
  return { code, message: getCartErrorMessage(code), detail: error.message };
}

// 讀取訪客購物車，內容不是合法的陣列就清除
function readGuestCarts() {
  try {
    const data = JSON.parse(localStorage.getItem('guestCarts'));
    if (Array.isArray(data)) return data;
  } catch {
    // 解析失敗和不是陣列的處理相同，下方統一清除
  }
  localStorage.removeItem('guestCarts');
  return [];
}

// 取得購物車列表
export const fetchCarts = createAsyncThunk(
  'cart/fetchCarts',
  async (preventGlobalLoading, { dispatch, getState, rejectWithValue }) => {
    // 取得 user 資訊
    const userId = getState().guestAuth.user?.id;
    if (!userId) return rejectWithValue({ code: 'NO_USER', message: getCartErrorMessage('NO_USER') });

    if (!preventGlobalLoading) dispatch(showLoading());
    try {
      const allProducts = await loadAllProducts(dispatch, getState);

      // 取得購物車資訊
      const { items, coupon, coupon_expired } = await cartApi.fetchCarts();

      // 合併購物車資訊
      const { carts, total } = mergeCartItems(items, allProducts);

      return {
        data: { carts, total, coupon, isCouponExpired: coupon_expired },
      };
    } catch (error) {
      return rejectWithValue(toCartError(error));
    } finally {
      if (!preventGlobalLoading) dispatch(hideLoading());
    }
  },
);
// 新增產品到購物車
export const addToCarts = createAsyncThunk(
  'cart/addToCarts',
  async ({ data, preventGlobalLoading }, { dispatch, rejectWithValue }) => {
    if (!preventGlobalLoading) dispatch(showLoading());
    try {
      // 新增產品到購物車
      const response = await cartApi.addToCart(data);

      return response;
    } catch (error) {
      return rejectWithValue(toCartError(error));
    } finally {
      if (!preventGlobalLoading) dispatch(hideLoading());
    }
  },
);
// 新增產品到購物車並重新取得購物車列表
export const addAndRefetchCarts = createAsyncThunk(
  'cart/addAndRefetchCarts',
  async ({ data, preventGlobalLoading }, { dispatch, rejectWithValue }) => {
    try {
      // 新增產品到購物車
      await dispatch(addToCarts({ data, preventGlobalLoading })).unwrap();

      // 重新取得購物車資料
      const response = await dispatch(fetchCarts(preventGlobalLoading)).unwrap();
      return response;
    } catch (error) {
      return rejectWithValue(toCartError(error));
    }
  },
);
// 更新購物車產品資訊並重新取得購物車列表
export const updateAndRefetchCarts = createAsyncThunk(
  'cart/updateAndRefetchCarts',
  async ({ id, qty, preventGlobalLoading }, { dispatch, getState, rejectWithValue }) => {
    // 取得 user 資訊
    const userId = getState().guestAuth.user?.id;
    if (!userId) return rejectWithValue({ code: 'NO_USER', message: getCartErrorMessage('NO_USER') });

    if (!preventGlobalLoading) dispatch(showLoading());
    try {
      // 先更新指定品項
      await cartApi.updateCart({ userId, id, qty });
      // 再重新取得購物車資料
      const response = await dispatch(fetchCarts(preventGlobalLoading)).unwrap();
      return response;
    } catch (error) {
      return rejectWithValue(toCartError(error));
    } finally {
      if (!preventGlobalLoading) dispatch(hideLoading());
    }
  },
);
// 刪除購物車產品並重新取得購物車列表
export const deleteAndRefetchCarts = createAsyncThunk(
  'cart/deleteAndRefetchCarts',
  async ({ id, preventGlobalLoading }, { dispatch, getState, rejectWithValue }) => {
    // 取得 user 資訊
    const userId = getState().guestAuth.user?.id;
    if (!userId) return rejectWithValue({ code: 'NO_USER', message: getCartErrorMessage('NO_USER') });

    if (!preventGlobalLoading) dispatch(showLoading());
    try {
      // 先刪除指定品項
      await cartApi.deleteCart({ userId, id });
      // 再重新取得購物車資料
      const response = await dispatch(fetchCarts(preventGlobalLoading)).unwrap();

      // 如果購物車內沒有商品，則清除優惠券代碼
      const carts = response.data.carts;
      if (carts.length === 0) {
        try {
          await guestCouponApi.deleteCartCoupon(userId);
        } catch {
          // 失敗仍繼續往下執行，不讓外部 catch 接到
        }
        dispatch(deleteCartCoupon());
      }

      return response;
    } catch (error) {
      return rejectWithValue(toCartError(error));
    } finally {
      if (!preventGlobalLoading) dispatch(hideLoading());
    }
  },
);
// 刪除購物車全部產品
export const deleteCarts = createAsyncThunk(
  'cart/deleteCarts',
  async (preventGlobalLoading, { dispatch, getState, rejectWithValue }) => {
    // 取得 user 資訊
    const userId = getState().guestAuth.user?.id;
    if (!userId) return rejectWithValue({ code: 'NO_USER', message: getCartErrorMessage('NO_USER') });

    if (!preventGlobalLoading) dispatch(showLoading());
    try {
      const response = await cartApi.deleteCarts({ userId });
      return response;
    } catch (error) {
      return rejectWithValue(toCartError(error));
    } finally {
      if (!preventGlobalLoading) dispatch(hideLoading());
    }
  },
);

/**
 * 登入/註冊後，購物車資料從 localStorage 改到後端儲存
 * - fulfilled：payload 為合併是否失敗（boolean）
 * - rejected：重新取得購物車失敗，payload 為錯誤物件；isMigrateError 表示合併是否失敗
 */
export const migrateGuestCart = createAsyncThunk(
  'cart/migrateGuestCart',
  async (_, { dispatch, rejectWithValue }) => {
    // 取得 localStorage 購物車資料
    const localCartData = readGuestCarts();

    // 新增多筆產品到購物車
    let isMigrateError = false;
    if (localCartData.length > 0) {
      const validItems = localCartData.filter(item => item.product_id && Number.isInteger(item.qty) && item.qty > 0);
      try {
        if (validItems.length > 0) {
          await dispatch(
            addToCarts({
              data: validItems,
              preventGlobalLoading: true,
            }),
          ).unwrap();
        }
        // 移除 localStorage
        localStorage.removeItem('guestCarts');
      } catch {
        isMigrateError = true;
      }
    }

    // 重新取得購物車資訊
    try {
      await dispatch(fetchCarts(true)).unwrap();
      return isMigrateError;
    } catch (error) {
      return rejectWithValue({ ...error, isMigrateError });
    }
  },
  {
    // 於 thunk 開始前執行。回傳 false，thunk 就不會執行
    condition: (_, { getState }) => !getState().cart.isMigrating,
  },
);

// slice
const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    carts: [],
    total: 0,
    coupon: null,
    isCouponExpired: false,
    isLoading: false, // 這是「整台購物車」的讀取狀態
    isMigrating: false,
    loadingItems: {}, // 追蹤每個產品的 loading 狀態，格式：{ cartId: null | 'updating' | 'deleting' }
    pendingBuyNowItem: null, // 未登入時，「立即購買」暫存商品，登入後由 Login/Register 在 migration 前加入 localStorage
    error: null,
  },
  reducers: {
    deleteCartCoupon: state => {
      state.coupon = null;
    },
    clearCouponExpired: state => {
      state.isCouponExpired = false;
    },
    setLocalCarts: (state, action) => {
      state.carts = action.payload;
    },
    addLocalCartItem: (state, action) => {
      const { product, productId, qty } = action.payload;
      const filterCart = state.carts.find(cart => cart.product_id === productId);
      const hasProduct = !!filterCart;
      if (hasProduct) {
        filterCart.qty += qty;
      } else {
        // id 用產品 id 替代
        state.carts.push({ id: productId, product, product_id: productId, qty });
      }
    },
    updateLocalCartItem: (state, action) => {
      const { productId, qty } = action.payload;
      const filterCart = state.carts.find(cart => cart.product_id === productId);
      if (!filterCart) return;
      filterCart.qty = qty;
    },
    deleteLocalCartItem: (state, action) => {
      const { cartItemId } = action.payload;
      state.carts = state.carts.filter(cart => cart.id !== cartItemId);
    },
    setPendingBuyNowItem: (state, action) => {
      state.pendingBuyNowItem = action.payload;
    },
    clearPendingBuyNowItem: state => {
      state.pendingBuyNowItem = null;
    },
    resetCart: state => {
      state.carts = [];
      state.total = 0;
      state.coupon = null;
      state.isCouponExpired = false;
      state.isLoading = false;
      state.isMigrating = false;
      state.loadingItems = {};
      state.pendingBuyNowItem = null;
      state.error = null;
    },
  },
  // Handle async thunks here
  extraReducers: builder => {
    builder
      // fetchCarts
      .addCase(fetchCarts.fulfilled, (state, action) => {
        state.isLoading = false;
        const data = action.payload.data;
        state.carts = data.carts || [];
        state.total = data.total || 0;
        state.coupon = data.coupon || null;
        if (data.isCouponExpired) state.isCouponExpired = true;
      })
      // migrateGuestCart
      .addCase(migrateGuestCart.pending, state => {
        state.isMigrating = true;
      })
      .addCase(migrateGuestCart.fulfilled, state => {
        state.isMigrating = false;
      })
      .addCase(migrateGuestCart.rejected, state => {
        state.isMigrating = false;
      })
      // updateAndRefetchCarts
      .addCase(updateAndRefetchCarts.pending, (state, action) => {
        const cartId = action.meta.arg.id;
        state.loadingItems[cartId] = 'updating';
        state.error = null;
      })
      // deleteAndRefetchCarts
      .addCase(deleteAndRefetchCarts.pending, (state, action) => {
        const cartId = action.meta.arg.id;
        state.loadingItems[cartId] = 'deleting';
        state.error = null;
      })
      // deleteCarts
      .addCase(deleteCarts.fulfilled, state => {
        state.isLoading = false;
        state.carts = [];
        state.total = 0;
        state.coupon = null;
        state.isCouponExpired = false;
        state.loadingItems = {};
      })
      .addMatcher(isAnyOf(addToCarts.fulfilled, addAndRefetchCarts.fulfilled), state => {
        if (!state.isMigrating) {
          state.isLoading = false;
        }
      })
      // 全域 loading 開始 (fetchCarts, addToCarts, addAndRefetchCarts, deleteCarts)
      .addMatcher(
        isAnyOf(fetchCarts.pending, addToCarts.pending, addAndRefetchCarts.pending, deleteCarts.pending),
        state => {
          if (!state.isMigrating) {
            state.isLoading = true;
          }
          state.error = null;
        },
      )
      // 全域操作失敗，清除全域 loading 狀態並記錄錯誤
      .addMatcher(
        isAnyOf(fetchCarts.rejected, addToCarts.rejected, addAndRefetchCarts.rejected, deleteCarts.rejected),
        (state, action) => {
          if (!state.isMigrating) {
            state.isLoading = false;
          }
          state.error = action.payload;
        },
      )
      // 單項操作完成，清除該項目的 loading 狀態
      .addMatcher(isAnyOf(updateAndRefetchCarts.fulfilled, deleteAndRefetchCarts.fulfilled), (state, action) => {
        const cartId = action.meta.arg.id;
        state.loadingItems[cartId] = null;
      })
      // 單項操作失敗，清除該項目的 loading 狀態並記錄錯誤
      .addMatcher(isAnyOf(updateAndRefetchCarts.rejected, deleteAndRefetchCarts.rejected), (state, action) => {
        const cartId = action.meta.arg.id;
        state.loadingItems[cartId] = null;
        state.error = action.payload;
      });
  },
});

export const authAwareInitCarts = preventGlobalLoading => async (dispatch, getState) => {
  const state = getState();
  // 取得登入狀態
  const isAuth = state.guestAuth.isAuth;

  if (isAuth) {
    // 已登入：呼叫後端 API 取得購物車資料
    // guestCarts 還有商品，代表上次合併失敗，先自動重試
    if (readGuestCarts().length > 0) {
      const migrateResult = await dispatch(migrateGuestCart());
      return { migrateResult };
    }
    return await dispatch(fetchCarts(preventGlobalLoading)).unwrap();
  } else {
    // 未登入：從 localStorage 讀取購物車資料
    const localCartData = readGuestCarts();
    // 訪客品項沒有資料庫的 id，用 product_id 代替（deleteLocalCartItem 依 id 刪除）
    const items = localCartData.map(({ product_id, qty }) => ({ id: product_id, product_id, qty }));
    try {
      const allProducts = await loadAllProducts(dispatch, getState);
      const { carts } = mergeCartItems(items, allProducts);

      // 將讀取到的資料寫入 Redux state
      dispatch(setLocalCarts(carts));
    } catch (error) {
      throw toCartError(error);
    }
  }
};
export const authAwareAddToCart = data => async (dispatch, getState) => {
  // 從 Redux store 中取得整體的 state
  const state = getState();

  // 取得登入狀態
  const isAuth = state.guestAuth.isAuth;

  const { product, qty } = data;
  if (isAuth) {
    // 已登入
    return await dispatch(addAndRefetchCarts({ data: [{ product_id: product.id, qty }] })).unwrap();
  } else {
    // 未登入
    dispatch(addLocalCartItem({ product, productId: product.id, qty }));
  }
};
export const authAwareUpdateCart = data => async (dispatch, getState) => {
  // 從 Redux store 中取得整體的 state
  const state = getState();

  // 取得登入狀態
  const isAuth = state.guestAuth.isAuth;

  const { cartItemId, productId, qty, preventGlobalLoading } = data;
  if (isAuth) {
    // 已登入
    return await dispatch(updateAndRefetchCarts({ id: cartItemId, qty, preventGlobalLoading })).unwrap();
  } else {
    // 未登入
    dispatch(updateLocalCartItem({ productId, qty }));
  }
};
export const authAwareDeleteCart = data => async (dispatch, getState) => {
  // 從 Redux store 中取得整體的 state
  const state = getState();

  // 取得登入狀態
  const isAuth = state.guestAuth.isAuth;

  const { cartItemId, preventGlobalLoading } = data;
  if (isAuth) {
    // 已登入
    return await dispatch(deleteAndRefetchCarts({ id: cartItemId, preventGlobalLoading })).unwrap();
  } else {
    // 未登入
    dispatch(deleteLocalCartItem({ cartItemId }));
  }
};

/**
 * 將暫存的「立即購買」商品加入 local cart（觸發 middleware 同步寫入 localStorage），
 * 確保後續 migrateGuestCart 讀取 localStorage 時能包含該商品。
 */
export const flushPendingBuyNowItem = () => (dispatch, getState) => {
  const { pendingBuyNowItem } = getState().cart;
  if (pendingBuyNowItem) {
    const { product, qty } = pendingBuyNowItem;
    dispatch(addLocalCartItem({ product, productId: product.id, qty }));
    dispatch(clearPendingBuyNowItem());
  }
};
/**
 * 其他分頁登入後：把這個分頁暫存的「立即購買」商品加入遠端購物車，再重新取得購物車。
 * - 加入失敗不會中斷，購物車照常重新取得
 * - 成功：回傳 { buyNowFailed }，立即購買的商品是否加入失敗
 * - 失敗：重新取得購物車失敗時丟出 { code, message }
 */
export const syncCartsAfterOtherTabSignIn = () => async (dispatch, getState) => {
  const { pendingBuyNowItem } = getState().cart;
  let buyNowFailed = false;
  if (pendingBuyNowItem) {
    const { product, qty } = pendingBuyNowItem;
    // 加入失敗只記下來、繼續往下，購物車照常重新取得；要不要顯示提示交給呼叫的地方
    const result = await dispatch(
      addToCarts({
        data: [{ product_id: product.id, qty }],
        preventGlobalLoading: true,
      }),
    );
    buyNowFailed = addToCarts.rejected.match(result);
    dispatch(clearPendingBuyNowItem());
  }
  await dispatch(fetchCarts(true)).unwrap();
  return { buyNowFailed };
};

// Export actions
export const {
  deleteCartCoupon,
  clearCouponExpired,
  setLocalCarts,
  addLocalCartItem,
  updateLocalCartItem,
  deleteLocalCartItem,
  setPendingBuyNowItem,
  clearPendingBuyNowItem,
  resetCart,
} = cartSlice.actions;

// Selectors
export const selectHasItemLoading = state => Object.values(state.cart.loadingItems).some(status => status);

export const selectFinalTotal = state => {
  const { total, coupon } = state.cart;
  return coupon ? Math.round((total * coupon.percent) / 100) : total;
};

export default cartSlice.reducer;
