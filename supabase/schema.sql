-- ============================================================
-- GCA — منصة متابعة توريد المدربين
-- سكيما قاعدة البيانات الكاملة (نسخ ولصق في Supabase SQL Editor ثم Run)
-- ============================================================

-- ---------- الملحقات ----------
create extension if not exists "pgcrypto";

-- ============================================================
-- التحكم بالصلاحيات (RBAC)
-- الأدوار: 'admin' (كامل الصلاحيات) و 'viewer' (اطلاع فقط — يقابل "user" في أنظمة RBAC العامة).
-- التخزين: عمود profiles.role. القيمة الافتراضية 'viewer' لأي مستخدم جديد (عبر trigger أدناه).
-- التطبيق الفعلي: سياسات RLS على trainers/programs تستخدم is_admin() — الرفض يحدث داخل
-- قاعدة البيانات نفسها، وليس فقط بإخفاء الأزرار في الواجهة.
-- منع تصعيد الصلاحية الذاتي: لا توجد أي policy من نوع UPDATE على جدول profiles، لذا لا يستطيع
-- أي مستخدم (حتى admin) تغيير role عبر الواجهة أو الـ API مطلقًا. الترقية إلى admin تتم يدويًا
-- فقط من Supabase Dashboard أو SQL Editor مباشرة (راجع أسفل الملف).
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

-- إنشاء صف profile تلقائيًا عند تسجيل مستخدم جديد (بصلاحية viewer افتراضيًا)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- دالة مساعدة: هل المستخدم الحالي admin؟
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- جدول المدربين ----------
create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text,
  qualification text,
  phone text,
  email text,
  status text not null default 'نشط',
  city text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- جدول البرامج التدريبية ----------
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  ref text,
  title text not null,
  type text,
  trainer_id uuid references public.trainers (id) on delete set null,
  mode text,
  start_date date,
  end_date date,
  days integer,
  hours numeric,
  location text,
  target_group text,
  participants integer,
  gca_contact text,
  status_gca text not null default 'مقترح',
  status_trainer text not null default 'تم الترشيح',
  notes text,
  contract_value numeric,
  due_portion text,
  entitlement_value numeric,
  due_date date,
  payment_status text not null default 'لم يُستحق بعد',
  coc_number text,
  invoice_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists programs_trainer_id_idx on public.programs (trainer_id);
create index if not exists programs_start_date_idx on public.programs (start_date);

-- ---------- جدول المدفوعات (أوامر الشراء ودفعاتها) ----------
-- كان اسمه project_payments سابقًا — يُعاد تسميته تلقائيًا مع الاحتفاظ ببياناته
do $$
begin
  if to_regclass('public.project_payments') is not null and to_regclass('public.payments') is null then
    alter table public.project_payments rename to payments;
  end if;
end $$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  purchase_order text,
  installments_total integer not null default 1 check (installments_total >= 1),
  installments_paid integer not null default 0 check (installments_paid >= 0),
  program_name text not null,
  contract_value numeric,
  due_portion text,
  entitlement_value numeric,
  due_date date,
  status text not null default 'تم الطلب',
  coc_number text,
  invoice_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- لقواعد بيانات فيها جدول payments بأعمدة مختلفة: نضيف كل ما ينقصه (آمن للتكرار)
alter table public.payments
  add column if not exists purchase_order text,
  add column if not exists installments_total integer not null default 1 check (installments_total >= 1),
  add column if not exists installments_paid integer not null default 0 check (installments_paid >= 0),
  add column if not exists program_name text not null default '',
  add column if not exists contract_value numeric,
  add column if not exists due_portion text,
  add column if not exists entitlement_value numeric,
  add column if not exists due_date date,
  add column if not exists status text not null default 'تم الطلب',
  add column if not exists coc_number text,
  add column if not exists invoice_number text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- ---------- تفعيل أمان مستوى الصف (RLS) ----------
alter table public.profiles enable row level security;
alter table public.trainers enable row level security;
alter table public.programs enable row level security;
alter table public.payments enable row level security;

-- profiles: كل مستخدم يقرأ ملفه الشخصي فقط
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- trainers: أي مستخدم مسجّل دخول يمكنه القراءة
drop policy if exists "authenticated read trainers" on public.trainers;
create policy "authenticated read trainers" on public.trainers
  for select using (auth.role() = 'authenticated');

-- trainers: التعديل والإضافة والحذف لصلاحية admin فقط
drop policy if exists "admin write trainers" on public.trainers;
create policy "admin write trainers" on public.trainers
  for all using (public.is_admin()) with check (public.is_admin());

-- programs: أي مستخدم مسجّل دخول يمكنه القراءة
drop policy if exists "authenticated read programs" on public.programs;
create policy "authenticated read programs" on public.programs
  for select using (auth.role() = 'authenticated');

-- programs: التعديل والإضافة والحذف لصلاحية admin فقط
drop policy if exists "admin write programs" on public.programs;
create policy "admin write programs" on public.programs
  for all using (public.is_admin()) with check (public.is_admin());

-- payments: أي مستخدم مسجّل دخول يمكنه القراءة
drop policy if exists "authenticated read project_payments" on public.payments;
drop policy if exists "authenticated read payments" on public.payments;
create policy "authenticated read payments" on public.payments
  for select using (auth.role() = 'authenticated');

-- payments: التعديل والإضافة والحذف لصلاحية admin فقط
drop policy if exists "admin write project_payments" on public.payments;
drop policy if exists "admin write payments" on public.payments;
create policy "admin write payments" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- جدول مدفوعات المدربين ----------
create table if not exists public.trainer_payments (
  id uuid primary key default gen_random_uuid(),
  program_name text not null,
  track text,
  trainer_id uuid references public.trainers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trainer_payments enable row level security;

drop policy if exists "authenticated read trainer_payments" on public.trainer_payments;
create policy "authenticated read trainer_payments" on public.trainer_payments
  for select using (auth.role() = 'authenticated');

drop policy if exists "admin write trainer_payments" on public.trainer_payments;
create policy "admin write trainer_payments" on public.trainer_payments
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- إجبار PostgREST على تحديث ذاكرة السكيما فورًا ----------
-- بدون هذا السطر قد تظهر أخطاء "Could not find the table" لبضع دقائق بعد إنشاء الجداول.
notify pgrst, 'reload schema';

-- ============================================================
-- لترقية حساب الإدارة الثابت إلى admin (بعد إنشائه من Authentication → Users):
--
--   update public.profiles set role = 'admin' where email = 'admin@gca.local';
--
-- ============================================================
