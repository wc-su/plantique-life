import adminClient from '../clients/adminClient';
import { supabaseGuest } from '../clients/guestClient';
import { ADMIN_API_PATH } from '../core/constants';

export const guestCouponApi = {
  applyCoupon: async ({ code }) => {
    const { data, error } = await supabaseGuest.rpc('apply_coupon', { p_code: code });
    if (error) throw error;
    return data;
  },
  deleteCartCoupon: async userId => {
    const { error } = await supabaseGuest.from('cart_coupons').delete().eq('user_id', userId);
    if (error) throw error;
    return true;
  },
};

export const adminCouponApi = {
  getCoupons: page => adminClient.get(`${ADMIN_API_PATH}/coupons?page=${page}`),

  createCoupon: data => adminClient.post(`${ADMIN_API_PATH}/coupon`, { data }),

  updateCoupon: (id, data) => adminClient.put(`${ADMIN_API_PATH}/coupon/${id}`, { data }),

  deleteCoupon: id => adminClient.delete(`${ADMIN_API_PATH}/coupon/${id}`),
};
