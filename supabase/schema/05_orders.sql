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

-- 授權 authenticated 角色查詢訂單，哪幾列由下面的 RLS policy 決定
-- 不給 insert：建立訂單只能透過 create_order，訂單內容和清空購物車在同一個 transaction 完成
-- 不給 update、delete：一般會員不能自己改付款狀態或刪除訂單；付款透過 pay_order
-- 後台需要修改、刪除時，再 grant 並加上 is_admin() 的 policy
-- 訪客 anon 不能查訂單
grant select on public.orders to authenticated;

-- SELECT: 一般會員看到自己的訂單，管理員看到全部
create policy "orders_select_own_or_admin"
on public.orders for select
using (auth.uid() = user_id or public.is_admin());

-- 依會員查訂單（前台訂單列表、RLS 的 auth.uid() = user_id）會用到 user_id
create index orders_user_id_idx on public.orders (user_id);

-- create_order: 用自己的購物車建立訂單；會新增 orders、order_items，刪除購物車裡已下單的商品和套用中的優惠券
-- 前端用 supabase.rpc('create_order', { p_order, p_products }) 呼叫
-- 一般會員沒有 orders、order_items 的 insert 權限，也讀不到 coupons，所以用 security definer；
-- 安全靠函式內容把關：只讀寫 user_id = auth.uid() 的資料、數量和優惠券從資料庫取、只寫入允許的欄位
create or replace function public.create_order(p_order jsonb, p_products jsonb)
returns public.orders              -- 回傳建立好的那一筆訂單
language plpgsql
security definer                   -- 用建立者（postgres）的身分執行，會略過 RLS
set search_path = ''               -- 固定 schema，下面的表都寫完整名稱 public.xxx
as $$
declare
  v_info public.orders;            -- p_order 轉成 orders 形狀後的收件資料
  v_total integer;
  v_coupon_code text;
  v_coupon_percent integer;
  v_coupon_valid boolean;
  v_result public.orders;
begin
  -- 鎖住自己的購物車：同時送出兩次時，第二次要等第一次完成，之後讀到的是已清空的購物車
  perform 1 from public.cart_items
  where user_id = auth.uid()
  for update;

  -- found：上一行有沒有找到資料；沒有就代表購物車是空的
  if not found then
    raise exception 'cart is empty' using errcode = 'CT001';
  end if;

  -- 購物車裡每個商品都要有前端送來的快照（名稱、價格、圖片）
  if exists (
    select 1
    from public.cart_items as ci
    where ci.user_id = auth.uid()
      and not exists (
        select 1
        from jsonb_to_recordset(p_products) as p(product_id text)
        where p.product_id = ci.product_id
      )
  ) then
    raise exception 'product snapshot is missing' using errcode = '22023';
  end if;

  -- 折扣前的金額：價格用前端送來的快照，數量用資料庫裡的購物車
  select sum(p.price * ci.qty)
  into v_total
  from public.cart_items as ci
  join jsonb_to_recordset(p_products) as p(product_id text, price integer)
    on p.product_id = ci.product_id
  where ci.user_id = auth.uid();

  -- 目前套用的優惠券；沒有套用時三個變數都是 null
  select c.code, c.percent, (c.is_enabled and c.due_date > now())
  into v_coupon_code, v_coupon_percent, v_coupon_valid
  from public.cart_coupons as cc
  join public.coupons as c on c.code = cc.coupon_code
  where cc.user_id = auth.uid();

  -- 套用之後才被停用或過期：不建立訂單，讓前端重新取得購物車（get_cart 會刪掉失效的券並提示）
  if v_coupon_code is not null and not v_coupon_valid then
    raise exception 'invalid coupon' using errcode = 'P0002';
  end if;

  -- 把 p_order 的 key 對應到 orders 的同名欄位；沒傳的欄位是 null
  v_info := jsonb_populate_record(null::public.orders, p_order);

  -- 只取收件、付款、發票這些欄位；user_id、金額、優惠券、付款狀態都不從 p_order 拿
  insert into public.orders (
    user_id,
    purchaser_name, purchaser_phone, purchaser_email,
    recipient_name, recipient_phone, recipient_email, recipient_address, message,
    delivery, payment, card_last_four, card_brand,
    invoice, mobile_barcode, ubn,
    total, final_total, coupon_code, coupon_percent
  ) values (
    auth.uid(),
    v_info.purchaser_name, v_info.purchaser_phone, v_info.purchaser_email,
    v_info.recipient_name, v_info.recipient_phone, v_info.recipient_email, v_info.recipient_address, v_info.message,
    v_info.delivery, v_info.payment, v_info.card_last_four, v_info.card_brand,
    v_info.invoice, v_info.mobile_barcode, v_info.ubn,
    v_total,
    -- 和前端 selectFinalTotal 相同：原價 × 付款比例 / 100，四捨五入
    case when v_coupon_percent is null then v_total
         else round(v_total * v_coupon_percent / 100.0)::integer end,
    v_coupon_code, v_coupon_percent
  )
  returning * into v_result;

  -- 品項快照：名稱、價格、圖片用前端送來的，數量用資料庫裡的購物車
  insert into public.order_items (order_id, product_id, title, price, image_url, qty)
  select v_result.id, ci.product_id, p.title, p.price, p.image_url, ci.qty
  from public.cart_items as ci
  join jsonb_to_recordset(p_products) as p(product_id text, title text, price integer, image_url text)
    on p.product_id = ci.product_id
  where ci.user_id = auth.uid();

  -- 只刪掉這次下單的商品：下單過程中若有另一個分頁新加入的商品，不算在該次訂單，維持留在購物車
  delete from public.cart_items as ci
  where ci.user_id = auth.uid()
    and ci.product_id in (
      select oi.product_id from public.order_items as oi where oi.order_id = v_result.id
    );
  -- 清空套用的優惠券
  delete from public.cart_coupons where user_id = auth.uid();

  return v_result;
end;
$$;

-- 新函式預設所有人都能執行（包括訪客 anon），只開放給登入的會員
revoke execute on function public.create_order(jsonb, jsonb) from public, anon;
grant execute on function public.create_order(jsonb, jsonb) to authenticated;
