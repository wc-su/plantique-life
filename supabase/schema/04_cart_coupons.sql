-- cart_coupons: 每個會員目前套用的優惠券，一個會員最多一筆
-- 前端只能刪除自己的那一筆；不能新增、修改，寫入只能透過 apply_coupon
-- get_cart 用來讀取購物車資料和套用中的優惠券

create table public.cart_coupons (
  -- user_id 當主鍵：一個會員只有一筆，apply_coupon 用 on conflict (user_id) 換成新的代碼
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  -- 外鍵指向 coupons.code：優惠券被刪除時一起刪除，代碼被修改時跟著更新
  coupon_code text not null references public.coupons(code) on update cascade on delete cascade
);

-- 替 cart_coupons 開啟 RLS
alter table public.cart_coupons enable row level security;
-- 授權 authenticated 角色查詢、刪除，哪幾列由下面的 RLS policy 決定
-- 不給 insert、update：只能透過 apply_coupon 寫入，存進來的一定是有效的代碼
-- delete 的 where 條件會讀 user_id，所以也要有 select 權限
-- 不給 anon：訪客不能套用優惠券
grant select, delete on public.cart_coupons to authenticated;

-- SELECT: 只能看到自己的
create policy "cart_coupons_select_own"
on public.cart_coupons for select
using (auth.uid() = user_id);

-- DELETE: 只能刪除自己的
create policy "cart_coupons_delete_own"
on public.cart_coupons for delete
using (auth.uid() = user_id);

-- get_cart: 一次取得自己的購物車資料和套用中的優惠券（已失效的優惠券會刪除）
-- 前端用 supabase.rpc('get_cart') 呼叫，回傳 { items: [...], coupon: {...} | null, coupon_expired: boolean }
-- 一般會員讀不到 coupons，所以用 security definer；cart_items 也會一起略過 RLS，查詢都要自己加上 user_id = auth.uid()
create or replace function public.get_cart()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon_expired boolean;
begin
  -- 先刪除失效的優惠券（套用之後才被停用或過期）
  delete from public.cart_coupons as cc
  using public.coupons as c
  where cc.user_id = auth.uid()
    and c.code = cc.coupon_code
    and not (c.is_enabled and c.due_date > now());

  -- found：前面 delete 有沒有刪到資料；有刪到就代表發現優惠券失效
  v_coupon_expired := found;

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', ci.id, 'product_id', ci.product_id, 'qty', ci.qty)
        order by ci.created_at, ci.id
      )
      from public.cart_items as ci
      where ci.user_id = auth.uid()  -- RLS 被略過了，一定要自己過濾
    ), '[]'::jsonb),
    'coupon', (
      select jsonb_build_object('code', c.code, 'title', c.title, 'percent', c.percent)
      from public.cart_coupons as cc
      join public.coupons as c on c.code = cc.coupon_code
      where cc.user_id = auth.uid()
    ),
    'coupon_expired', v_coupon_expired
  );
end;
$$;

-- 新函式預設所有人都能執行（包括訪客 anon），只開放給登入的會員
revoke execute on function public.get_cart() from public, anon;
grant execute on function public.get_cart() to authenticated;
