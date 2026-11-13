import adminClient from '../clients/adminClient';
import guestClient, { supabaseGuest } from '../clients/guestClient';
import { ADMIN_API_PATH, GUEST_API_PATH } from '../core/constants';

const ORDERS = 'orders';
const ORDERS_PER_PAGE = 10;

// 查某一頁的訂單，連同總筆數
const queryOrdersPage = ({ userId, page = 1 }) => {
  const from = (page - 1) * ORDERS_PER_PAGE;
  const to = from + ORDERS_PER_PAGE - 1;

  return supabaseGuest
    .from(ORDERS)
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);
};
// 組成訂單列表、分頁元件使用的 { orders, pagination }
const toOrdersResult = (result, page) => {
  return {
    orders: result.data,
    pagination: { current_page: page, total_pages: Math.ceil(result.count / ORDERS_PER_PAGE) },
  };
};

export const guestOrderApi = {
  // 建立訂單
  createOrder: async ({ order, products }) => {
    const { data, error } = await supabaseGuest.rpc('create_order', { p_order: order, p_products: products });
    if (error) throw error;
    return data;
  },
  // 取得所有訂單
  fetchOrders: async ({ userId, page = 1 }) => {
    const result = await queryOrdersPage({ userId, page });
    // 超過範圍有兩種情況：
    // 1. 起點大於總筆數：會回傳錯誤 PGRST103
    // 2. 起點剛好等於總筆數（例如剛好 10 筆時查 page=2）：不會報錯，會回傳空陣列
    const isOutOfRange =
      result.error?.code === 'PGRST103' || (!result.error && result.data.length === 0 && result.count > 0);
    if (!isOutOfRange) {
      if (result.error) throw result.error;
      return toOrdersResult(result, page);
    }

    // 頁數超過範圍：查總筆數，改查最後一頁
    const { count, error } = await supabaseGuest
      .from(ORDERS)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw error;

    const lastPage = Math.max(1, Math.ceil(count / ORDERS_PER_PAGE));
    const lastResult = await queryOrdersPage({ userId, page: lastPage });
    if (lastResult.error) throw lastResult.error;
    return toOrdersResult(lastResult, lastPage);
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
