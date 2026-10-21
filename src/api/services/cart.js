import guestClient, { supabaseGuest } from '../clients/guestClient';
import { GUEST_API_PATH } from '../core/constants';

const CART_ITEMS = 'cart_items';

export const cartApi = {
  // 取得購物車列表
  fetchCarts: async userId => {
    const { data, error } = await supabaseGuest
      .from(CART_ITEMS)
      .select('id, product_id, qty')
      .eq('user_id', userId)
      .order('created_at');
    if (error) throw error;
    return data;
  },
  // 新增產品到購物車
  addToCart: async ({ product_id, qty }) => {
    const { data, error } = await supabaseGuest.rpc('add_to_cart', { p_product_id: product_id, p_qty: qty });
    if (error) throw error;
    return data;
  },
  // 更新購物車產品資訊
  updateCart: (id, data, preventGlobalLoading) =>
    guestClient.put(`${GUEST_API_PATH}/cart/${id}`, { data }, { preventGlobalLoading }),
  // 刪除購物車產品
  deleteCart: (id, preventGlobalLoading) =>
    guestClient.delete(`${GUEST_API_PATH}/cart/${id}`, { preventGlobalLoading }),
  // 刪除購物車全部產品
  deleteCarts: preventGlobalLoading => guestClient.delete(`${GUEST_API_PATH}/carts`, { preventGlobalLoading }),
};
