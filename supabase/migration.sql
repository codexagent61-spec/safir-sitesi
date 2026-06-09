-- ============================================================================
-- SAFİR SİTESİ YÖNETİM PANELİ – Veritabanı Kurulum Betiği
-- ============================================================================
-- Bu betik Supabase SQL Editor'de bir kez çalıştırılır (tekrar çalıştırmak
-- güvenlidir; mevcut tablolar korunur).
--
-- Kurduğu yapı:
--   * profiles        : kullanıcılar ve rolleri (admin / sayman / muhasebeci / pending)
--   * residents       : sakinler (Blok-Daire No, giriş kat, isim, soyisim)
--   * dues_tariffs    : kat bazlı aylık aidat tarifeleri (yürürlük yıl/ay ile)
--   * interest_rates  : aylık gecikme faizi oranları (yürürlük yıl/ay ile)
--   * app_settings    : son ödeme günü gibi genel ayarlar (tek satır)
--   * payments        : aidat tahsilatları (dönem, tutar, banka/elden)
--   * expenses        : VUK alanlarıyla masraf kayıtları
--   * monthly_income(): muhasebecinin tek görebildiği aidat verisi (aylık toplam)
--
-- Güvenlik: tüm tablolarda RLS açık. Yönetici/Sayman her şeye erişir;
-- Muhasebeci yalnızca masrafları okur + monthly_income() çağırır;
-- onay bekleyen kullanıcı hiçbir veriye erişemez.
-- İlk kayıt olan kullanıcı otomatik olarak Yönetici (admin) olur.
-- ============================================================================

-- ------------------------------------------------------------------ Enumlar
do $$ begin
  create type public.user_role as enum ('admin', 'sayman', 'muhasebeci', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('banka', 'elden');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_type as enum ('fatura', 'fis');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------ Tablolar
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null default '',
  full_name  text not null default '',
  role       public.user_role not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.residents (
  id              uuid primary key default gen_random_uuid(),
  unit_no         text not null,
  is_ground_floor boolean not null default false,  -- Giriş Kat varsayılanı: Hayır
  first_name      text not null,
  last_name       text not null default '',
  created_at      timestamptz not null default now(),
  constraint residents_unit_no_unique unique (unit_no),
  constraint residents_unit_no_not_blank check (length(btrim(unit_no)) > 0),
  constraint residents_first_name_not_blank check (length(btrim(first_name)) > 0)
);

create table if not exists public.dues_tariffs (
  id                  uuid primary key default gen_random_uuid(),
  effective_year      int not null check (effective_year between 2000 and 2100),
  effective_month     int not null check (effective_month between 1 and 12),
  normal_amount       numeric(12,2) not null check (normal_amount >= 0),
  ground_floor_amount numeric(12,2) not null check (ground_floor_amount >= 0),
  created_at          timestamptz not null default now(),
  constraint dues_tariffs_period_unique unique (effective_year, effective_month)
);

create table if not exists public.interest_rates (
  id               uuid primary key default gen_random_uuid(),
  effective_year   int not null check (effective_year between 2000 and 2100),
  effective_month  int not null check (effective_month between 1 and 12),
  monthly_rate_pct numeric(6,3) not null check (monthly_rate_pct >= 0 and monthly_rate_pct <= 100),
  created_at       timestamptz not null default now(),
  constraint interest_rates_period_unique unique (effective_year, effective_month)
);

create table if not exists public.app_settings (
  id         int primary key check (id = 1),       -- tek satırlık ayar tablosu
  due_day    int not null default 31 check (due_day between 1 and 31),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  resident_id  uuid not null references public.residents(id) on delete restrict,
  period_year  int not null check (period_year between 2000 and 2100),
  period_month int not null check (period_month between 1 and 12),
  amount       numeric(12,2) not null check (amount > 0),
  paid_on      date not null check (paid_on between date '2000-01-01' and date '2100-01-01'),
  method       public.payment_method not null,
  note         text not null default '',
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index if not exists payments_period_idx on public.payments (period_year, period_month);
create index if not exists payments_resident_idx on public.payments (resident_id);

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  doc_type     public.document_type not null,
  vendor_title text not null check (length(btrim(vendor_title)) > 0),
  tax_number   text not null check (tax_number ~ '^[0-9]{10,11}$'),
  doc_date     date not null check (doc_date between date '2000-01-01' and date '2100-01-01'),
  doc_no       text not null check (length(btrim(doc_no)) > 0),
  base_amount  numeric(12,2) not null check (base_amount >= 0),
  vat_rate     numeric(5,2) not null check (vat_rate >= 0 and vat_rate <= 100),
  vat_amount   numeric(12,2) not null check (vat_amount >= 0),
  total_amount numeric(12,2) not null,
  description  text not null default '',
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null,
  -- Veri bütünlüğü: Toplam = Matrah + KDV (uygulama da garanti eder, DB de denetler)
  constraint expenses_total_consistent check (total_amount = base_amount + vat_amount)
);

create index if not exists expenses_doc_date_idx on public.expenses (doc_date);

-- ------------------------------------------------- Rol yardımcı fonksiyonu
-- security definer: profiles üzerindeki RLS'e takılmadan oturum sahibinin
-- rolünü okur (politika ifadelerinde kullanılır).
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role::text from public.profiles p where p.id = auth.uid()), 'anon');
$$;

revoke all on function public.my_role() from public;
grant execute on function public.my_role() to authenticated, anon;

-- ------------------------------------------- Yeni kullanıcı → profil trigger
-- İlk kayıt olan kullanıcı admin, sonrakiler 'pending' (onay bekler) olur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when exists (select 1 from public.profiles where role = 'admin') then 'pending'::public.user_role
      else 'admin'::public.user_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Betik çalıştırılmadan önce kayıt olmuş kullanıcılar için profil tamamla
insert into public.profiles (id, email, full_name, role)
select u.id,
       coalesce(u.email, ''),
       coalesce(u.raw_user_meta_data ->> 'full_name', ''),
       'pending'::public.user_role
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Hiç admin yoksa en eski kayıtlı kullanıcıyı admin yap
update public.profiles
set role = 'admin'
where not exists (select 1 from public.profiles where role = 'admin')
  and id = (select id from public.profiles order by created_at asc limit 1);

-- ------------------------------------------------- Son admin koruması
create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin'
     and not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
    raise exception 'Sistemdeki son Yöneticinin rolü değiştirilemez.';
  end if;
  if tg_op = 'DELETE' and old.role = 'admin'
     and not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
    raise exception 'Sistemdeki son Yönetici silinemez.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists protect_last_admin_trg on public.profiles;
create trigger protect_last_admin_trg
  before update or delete on public.profiles
  for each row execute function public.protect_last_admin();

-- ------------------------------------------------- Muhasebeci geliri RPC'si
-- Muhasebeci ödeme kayıtlarını GÖREMEZ; yalnızca bu fonksiyonla seçtiği
-- dönemin toplam aidat gelirini öğrenebilir.
create or replace function public.monthly_income(p_year int, p_month int)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.my_role() not in ('admin', 'sayman', 'muhasebeci') then
    raise exception 'Bu bilgi için yetkiniz yok.';
  end if;
  return coalesce(
    (select sum(amount) from public.payments
      where period_year = p_year and period_month = p_month),
    0
  );
end;
$$;

revoke all on function public.monthly_income(int, int) from public;
grant execute on function public.monthly_income(int, int) to authenticated;

-- ------------------------------------------------------------------ RLS
alter table public.profiles       enable row level security;
alter table public.residents      enable row level security;
alter table public.dues_tariffs   enable row level security;
alter table public.interest_rates enable row level security;
alter table public.app_settings   enable row level security;
alter table public.payments       enable row level security;
alter table public.expenses       enable row level security;

-- Anonim (giriş yapmamış) istemciler tablolara hiç dokunamasın
revoke all on all tables in schema public from anon;

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select using (public.my_role() in ('admin', 'sayman'));

create policy profiles_update_admin on public.profiles
  for update
  using (public.my_role() in ('admin', 'sayman'))
  with check (public.my_role() in ('admin', 'sayman'));

-- residents -----------------------------------------------------------------
drop policy if exists residents_admin_all on public.residents;
create policy residents_admin_all on public.residents
  for all
  using (public.my_role() in ('admin', 'sayman'))
  with check (public.my_role() in ('admin', 'sayman'));

-- dues_tariffs ----------------------------------------------------------------
drop policy if exists dues_tariffs_admin_all on public.dues_tariffs;
create policy dues_tariffs_admin_all on public.dues_tariffs
  for all
  using (public.my_role() in ('admin', 'sayman'))
  with check (public.my_role() in ('admin', 'sayman'));

-- interest_rates --------------------------------------------------------------
drop policy if exists interest_rates_admin_all on public.interest_rates;
create policy interest_rates_admin_all on public.interest_rates
  for all
  using (public.my_role() in ('admin', 'sayman'))
  with check (public.my_role() in ('admin', 'sayman'));

-- app_settings ----------------------------------------------------------------
drop policy if exists app_settings_admin_all on public.app_settings;
create policy app_settings_admin_all on public.app_settings
  for all
  using (public.my_role() in ('admin', 'sayman'))
  with check (public.my_role() in ('admin', 'sayman'));

-- payments --------------------------------------------------------------------
-- Muhasebeci dahil hiçbir yan rol ödeme kayıtlarını göremez (aylık toplam
-- için monthly_income fonksiyonu kullanılır).
drop policy if exists payments_admin_all on public.payments;
create policy payments_admin_all on public.payments
  for all
  using (public.my_role() in ('admin', 'sayman'))
  with check (public.my_role() in ('admin', 'sayman'));

-- expenses --------------------------------------------------------------------
drop policy if exists expenses_admin_all        on public.expenses;
drop policy if exists expenses_muhasebeci_read  on public.expenses;

create policy expenses_admin_all on public.expenses
  for all
  using (public.my_role() in ('admin', 'sayman'))
  with check (public.my_role() in ('admin', 'sayman'));

create policy expenses_muhasebeci_read on public.expenses
  for select using (public.my_role() = 'muhasebeci');

-- ============================================================================
select 'Safir Sitesi veritabanı kurulumu tamamlandı ✔' as sonuc;
