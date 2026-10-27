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

-- apply_coupon: 前台套用優惠券；驗證代碼，有效就存成這個會員目前的優惠券，回傳名稱和付款比例
-- 一般會員沒有 coupons 的 policy，也沒有 cart_coupons 的寫入權限，所以用 security definer；
-- 安全改靠函式內容：只用傳進來的 code 查詢、只回傳需要的欄位、停用或過期就報錯、只寫入自己的那一列
create or replace function public.apply_coupon(p_code text)
returns jsonb                      -- 回傳單一物件 { code, title, percent }
language plpgsql
security definer                   -- 用建立者（postgres）的身分執行，會略過 RLS
set search_path = ''               -- 固定 schema，下面的表都寫完整名稱 public.xxx
as $$
declare
  v_coupon jsonb;
begin
  -- 沒有傳優惠碼就直接擋下
  if p_code is null or p_code = '' then
    raise exception 'coupon code is required' using errcode = '22023';
  end if;

  -- 只取需要的三個欄位，組成 JSON 存進變數
  select jsonb_build_object('code', c.code, 'title', c.title, 'percent', c.percent)
  into v_coupon
  from public.coupons as c
  where c.code = p_code            -- 只查這一個碼；code 是 unique，最多一筆
    and c.is_enabled               -- 停用的不算
    and c.due_date > now();        -- 已過期的不算

  -- 查不到、停用、過期都回同一個錯誤，不讓人分辨「這個代碼存在但停用了」
  if not found then
    raise exception 'invalid coupon' using errcode = 'P0002';
  end if;

  -- 存成這個會員目前的優惠券；已經套用過一筆就換成新的
  -- user_id 一律用 auth.uid()，不接受前端傳入
  insert into public.cart_coupons (user_id, coupon_code)
  values (auth.uid(), p_code)
  on conflict (user_id)
  do update set coupon_code = excluded.coupon_code;

  return v_coupon;
end;
$$;

-- 新函式預設所有人都能執行（包括訪客 anon），只開放給登入的會員
revoke execute on function public.apply_coupon(text) from public, anon;
grant execute on function public.apply_coupon(text) to authenticated;
