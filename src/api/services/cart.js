import { supabaseGuest } from '../clients/guestClient';

const CART_ITEMS = 'cart_items';

export const cartApi = {
  // 取得購物車列表
  fetchCarts: async () => {
    const { data, error } = await supabaseGuest.rpc('get_cart');
    if (error) throw error;
    return data;
  },
  // 新增多筆產品到購物車
  addToCart: async items => {
    const { data, error } = await supabaseGuest.rpc('add_to_cart', { p_items: items });
    if (error) throw error;
    return data;
  },
  // 更新購物車產品資訊
  updateCart: async ({ userId, id, qty }) => {
    const { data, error } = await supabaseGuest
      .from(CART_ITEMS)
      .update({ qty })
      .eq('user_id', userId)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data;
  },
  // 刪除購物車產品
  deleteCart: async ({ userId, id }) => {
    const { data, error } = await supabaseGuest.from(CART_ITEMS).delete().eq('user_id', userId).eq('id', id).select();
    if (error) throw error;
    return data;
  },
  // 刪除購物車全部產品
  deleteCarts: async ({ userId }) => {
    const { data, error } = await supabaseGuest.from(CART_ITEMS).delete().eq('user_id', userId).select();
    if (error) throw error;
    return data;
  },
};
