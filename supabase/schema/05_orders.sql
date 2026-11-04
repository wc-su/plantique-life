-- orders: 會員的訂單；建立時把收件資料、金額、優惠券存成快照
-- 只能透過 create_order 建立，一般會員不能直接新增、修改、刪除
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- 刪除帳號時一起刪除訂單
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- 訂購人
  purchaser_name text not null,
  purchaser_phone text not null,
  purchaser_email text not null,
  -- 收件人
  recipient_name text not null,
  recipient_phone text not null,
  recipient_email text not null,
  recipient_address text not null,
  message text,

  -- 運送、付款方式，值和前端的下拉選項相同
  delivery text not null check (delivery in ('黑貓宅配')),
  payment text not null check (payment in ('貨到付款', '信用卡一次付清', '轉帳')),
  -- 信用卡只存末四碼和卡別
  card_last_four text check (card_last_four ~ '^\d{4}$'),
  card_brand text,
  -- 選信用卡時必須有末四碼，其他付款方式不能有
  constraint orders_card_check
    check ((payment = '信用卡一次付清') = (card_last_four is not null)),

  -- 發票類型，值和前端的下拉選項相同
  invoice text not null check (invoice in ('電子發票', '雲端載具', '統一編號')),
  mobile_barcode text,
  ubn text check (ubn ~ '^\d{8}$'),
  -- 雲端載具必須有手機條碼，統一編號必須有統編
  constraint orders_invoice_mobile_barcode_check
    check (invoice <> '雲端載具' or mobile_barcode is not null),
  constraint orders_invoice_ubn_check
    check (invoice <> '統一編號' or ubn is not null),

  -- 金額（新台幣整數）；total 是折扣前，final_total 是折扣後
  total integer not null check (total >= 0),
  final_total integer not null check (final_total >= 0),
  -- 優惠券快照：不加外鍵，優惠券被刪除或修改也不影響舊訂單
  coupon_code text,
  coupon_percent integer check (coupon_percent between 1 and 100),

  -- 付款狀態：pay_order 會同時改這兩個欄位
  is_paid boolean not null default false,
  paid_at timestamptz,
  -- 已付款就一定要有付款時間，未付款就不能有
  constraint orders_paid_check
    check (is_paid = (paid_at is not null)),

  created_at timestamptz not null default now()
);

-- 替 orders 開啟 RLS
alter table public.orders enable row level security;

