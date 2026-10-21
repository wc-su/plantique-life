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
-- UPDATE 只開放 qty：加入購物車用 add_to_cart（只更新 qty），修改數量也只改 qty；不能把品項改成別的商品
-- 不給 anon：訪客購物車存在 localStorage，不會直接讀寫這張表
grant select, insert, delete on public.cart_items to authenticated;
grant update (qty) on public.cart_items to authenticated;

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

-- add_to_cart: 加入購物車；已經有這個商品時，把數量加上去
-- 前端用 supabase.rpc('add_to_cart', { p_product_id, p_qty }) 呼叫
create or replace function public.add_to_cart(p_product_id text, p_qty integer)
returns public.cart_items          -- 回傳寫入後的那一筆
language plpgsql
security invoker                   -- 用呼叫者（登入的會員）的身分執行，RLS 照樣生效
set search_path = ''               -- 不依賴預設的 schema，下面的表都寫完整名稱 public.xxx
as $$
declare
  result public.cart_items;
begin
  -- 數量必須大於 0：已經有既有品項時走 update，check (qty > 0) 只檢查加完的結果，擋不住負數
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty must be greater than 0' using errcode = '22023';
  end if;

  -- user_id 不用傳，表的預設值是 auth.uid()
  insert into public.cart_items as c (product_id, qty)
  values (p_product_id, p_qty)
  -- 同一個會員、同一個商品已經有一筆（unique 衝突）時，不報錯，改成更新
  on conflict (user_id, product_id)
  -- excluded 是這次想新增的那一筆；原本的數量加上這次的數量
  do update set qty = c.qty + excluded.qty
  returning * into result;

  return result;
end;
$$;

-- 新函式預設所有人都能執行（包括訪客 anon），只開放給登入的會員
revoke execute on function public.add_to_cart(text, integer) from public, anon;
grant execute on function public.add_to_cart(text, integer) to authenticated;
