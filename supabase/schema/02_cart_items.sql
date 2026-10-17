-- cart_items: 會員的購物車，只存商品編號和數量
-- 商品名稱、價格、圖片不存在這裡，讀取時在前端用 allProducts 合併

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  -- 前端新增時不用傳 user_id，資料庫自動帶入目前登入者
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- 課程 API 的商品 id（字串），外部參照，所以沒辦法加外鍵
  product_id text not null,
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now(),
  -- 同一個會員、同一個商品只會有一筆，再加入時改數量（之後可用 upsert）
  unique (user_id, product_id)
);

-- 替 cart_items 開啟 RLS
alter table public.cart_items enable row level security;

-- 授權 authenticated 角色增刪改查購物車，哪幾列由下面的 RLS policy 決定
-- UPDATE 只開放 product_id、qty：upsert 撞到時會更新送出的所有欄位，所以 product_id 也要開放
-- 不給 anon：訪客購物車存在 localStorage，不會直接讀寫這張表
grant select, insert, delete on public.cart_items to authenticated;
grant update (product_id, qty) on public.cart_items to authenticated;

-- SELECT: 只能看到自己的購物車
create policy "cart_items_select_own"
on public.cart_items for select
using (auth.uid() = user_id);

-- INSERT: 只能新增到自己的購物車（擋住前端塞別人的 user_id）
create policy "cart_items_insert_own"
on public.cart_items for insert
with check (auth.uid() = user_id);

-- UPDATE: 只能修改自己的品項，改完也必須還是自己的
create policy "cart_items_update_own"
on public.cart_items for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- DELETE: 只能刪除自己的品項
create policy "cart_items_delete_own"
on public.cart_items for delete
using (auth.uid() = user_id);
