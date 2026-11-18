import { supabaseGuest } from '../clients/guestClient';

export const payApi = {
  // 付款
  payOrder: async orderId => {
    const { error } = await supabaseGuest.rpc('pay_order', { p_order_id: orderId });
    if (error) throw error;
  },
};
