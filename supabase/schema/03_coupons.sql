-- coupons: 優惠券，全站共用，不屬於任何會員（所以沒有 user_id）
-- 只有管理員能直接讀寫這張表；前台套用優惠券改用 apply_coupon(code) 查詢，
-- 一般會員不會拿到所有優惠碼

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  -- 優惠碼，不能重複；unique 會自動建立索引，apply_coupon 用 code 查詢會比較快
  code text not null unique,
  title text not null,
  -- 付款比例（%），80 代表打八折，結帳金額 = 原價 × percent / 100
  percent integer not null check (percent between 1 and 100),
  -- 到期時間
  due_date timestamptz not null,
  -- 是否啟用
  is_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- 替 coupons 開啟 RLS
alter table public.coupons enable row level security;
-- 授權 authenticated 角色增刪改查優惠券，哪幾列由下面的 RLS policy 決定
-- UPDATE 只開放可以編輯的欄位，id、created_at 不能改
-- 不給 anon：訪客不能查優惠券
grant select, insert, delete on public.coupons to authenticated;
grant update (code, title, percent, due_date, is_enabled) on public.coupons to authenticated;

-- 只有管理員能讀寫；一般會員查詢會拿到空陣列，新增、修改、刪除都會被擋
-- for all：一條 policy 同時套用到 SELECT、INSERT、UPDATE、DELETE
create policy "coupons_admin_all"
on public.coupons for all
using (public.is_admin())
with check (public.is_admin());

-- 沒有給一般會員的 policy：前台套用優惠券透過 apply_coupon（security definer，略過 RLS），
-- 只回傳查到的那一張，不會拿到全部優惠碼
