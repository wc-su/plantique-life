-- profiles: 補充 auth.users 沒有的會員資料（身分、姓名、是否訂閱）
-- 也定義了其他資料表的 RLS 會共用的 user_role、is_admin()
-- 不需儲存 email/password 的資訊，資料已經存在 auth.users 中

-- 會員身分分類
create type public.user_role as enum ('customer', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  name text,
  receive_news boolean not null default false,
  created_at timestamptz not null default now()
);

-- 替 profiles 開啟 RLS
alter table public.profiles enable row level security;

-- 授權 authenticated 角色讀取 profiles，只能更新這三個欄位（id、created_at 前端改不了）
-- 哪幾列由下面的 RLS policy 決定；role 的修改另外由 prevent_role_escalation 擋
grant select on public.profiles to authenticated;
grant update (name, receive_news, role) on public.profiles to authenticated;

-- 當 auth.users 有新資料時自動建立 profiles 資料
-- (包含使用 email/password 註冊以及 OAuth 註冊)
-- name / receive_news 從註冊時的 options.data (raw_user_meta_data) 取得
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, receive_news)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    coalesce((new.raw_user_meta_data ->> 'receive_news')::boolean, false)
  );
  return new;
end;
$$;

-- 建立 trigger: 當 auth.users 有新資料時呼叫 public.handle_new_user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: 確認使用者是否有管理員身分
-- 使用 security definer 略過 RLS 避免讀取 profiles 產生無限迴圈
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- SELECT: 一般會員可以看到自己的 profile，管理者可以看到全部人的資料
create policy "profiles_select_own_or_admin"
on public.profiles for select
using (auth.uid() = id or public.is_admin());

-- UPDATE: 一般會員可以更新自己的 profile，管理者可以更新任何人的資料
-- (role 的修改由下面 trigger 擋住，一般會員沒辦法自己升級成 admin)
create policy "profiles_update_own_or_admin"
on public.profiles for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

-- 一般會員不能修改 role（不能把自己升級成 admin）
-- 上面的 UPDATE policy 只能限制「改哪一筆」，不能限制「改哪個欄位」，所以另外用 trigger 擋
create function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role and not public.is_admin() then
    raise exception 'Only admins can change role';
  end if;
  return new;
end;
$$;

-- 更新 profiles 之前呼叫 prevent_role_escalation
create trigger before_profile_update
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- 沒有設定 INSERT/DELETE policies: 新增只透過上面的 handle_new_user trigger（security definer，略過 RLS）
-- 刪除透過 auth.users 外鍵的 on delete cascade，刪除帳號時自動一起刪除
