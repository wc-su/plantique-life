export const MIN_PRODUCT_PURCHASE_QTY = 1;
export const MAX_RECOMMEND_PRODUCTS_DISPLAY_COUNT = 4;

// 文字要和 supabase/schema/05_orders.sql 的 check 一致，修改時 SQL 也要一起改
export const DELIVERY = Object.freeze({
  YAMATO_TRANSPORT: '黑貓宅配',
});

export const PAYMENT = Object.freeze({
  CASH_ON_DELIVERY: '貨到付款',
  CREDIT_CARD: '信用卡一次付清',
  TRANSFER: '轉帳',
});

export const INVOICE = Object.freeze({
  E_INVOICE: '電子發票',
  MOBILE_BARCODE: '雲端載具',
  UBN: '統一編號',
});

export const paymentOptions = Object.values(PAYMENT);
export const invoiceOptions = Object.values(INVOICE);
export const deliveryOptions = Object.values(DELIVERY);
