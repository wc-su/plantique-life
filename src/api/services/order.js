import adminClient from '../clients/adminClient';
import guestClient, { supabaseGuest } from '../clients/guestClient';
import { ADMIN_API_PATH, GUEST_API_PATH } from '../core/constants';

const ORDERS = 'orders';
const ORDERS_PER_PAGE = 10;

export const guestOrderApi = {
  // 建立訂單
  createOrder: async ({ order, products }) => {
    const { data, error } = await supabaseGuest.rpc('create_order', { p_order: order, p_products: products });
    if (error) throw error;
    return data;
  },
  // 取得所有訂單
  fetchOrders: async ({ userId, page = 1 }) => {
    const from = (page - 1) * ORDERS_PER_PAGE;
    const to = from + ORDERS_PER_PAGE - 1;

    const { data, count, error } = await supabaseGuest
      .from(ORDERS)
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return {
      orders: data,
      pagination: { current_page: page, total_pages: Math.ceil(count / ORDERS_PER_PAGE) },
    };
  },
  // 取得指定 ID 訂單
  fetchOrderById: orderId => guestClient.get(`${GUEST_API_PATH}/order/${orderId}`),
};

export const adminOrderApi = {
  // 取得訂單列表
  fetchOrders: (page = 1) => adminClient.get(`${ADMIN_API_PATH}/orders`, { params: { page } }),
  // 更新訂單資訊
  updateOrder: (id, data) => adminClient.put(`${ADMIN_API_PATH}/order/${id}`, { data }),
  // 刪除訂單
  deleteOrder: id => adminClient.delete(`${ADMIN_API_PATH}/order/${id}`),
  // 刪除全部訂單
  deleteOrders: () => adminClient.delete(`${ADMIN_API_PATH}/orders/all`),
};
