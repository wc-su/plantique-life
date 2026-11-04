-- order_items: 訂單裡的每一項商品，存下單當下的名稱、價格、圖片快照
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
  image_url text,
  qty integer not null check (qty > 0),
  -- 同一張訂單、同一個商品只會有一筆
  unique (order_id, product_id)
);

-- 替 order_items 開啟 RLS
alter table public.order_items enable row level security;
