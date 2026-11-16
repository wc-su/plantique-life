-- order_items: 訂單裡的每一項商品，存下單時的名稱、價格、原價、圖片快照
-- 依訂單查品項時會用 order_id，unique (order_id, product_id) 已經建立索引，不用另外加
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  -- 刪除訂單時一起刪除品項
  order_id uuid not null references public.orders(id) on delete cascade,
  -- 課程 API 的商品 id（外部參照，沒辦法加外鍵）
  product_id text not null,
  -- 快照
  title text not null,
  price integer not null check (price >= 0),
  origin_price integer not null check (origin_price >= 0),
  image_url text,
  qty integer not null check (qty > 0),
  -- 同一張訂單、同一個商品只會有一筆
  unique (order_id, product_id)
);

-- 替 order_items 開啟 RLS
alter table public.order_items enable row level security;

-- 授權 authenticated 角色查詢品項，哪幾列由下面的 RLS policy 決定
-- 不給 insert、update、delete：品項只能透過 create_order 寫入，建立後不能修改
grant select on public.order_items to authenticated;

-- SELECT: 品項所屬的訂單是自己的，或是管理員
-- order_items 沒有 user_id，要透過 order_id 找到訂單再判斷
create policy "order_items_select_own_or_admin"
on public.order_items for select
using (
  public.is_admin()
  or exists (
    select 1 from public.orders as o
    where o.id = order_items.order_id
      and o.user_id = auth.uid()
  )
);
