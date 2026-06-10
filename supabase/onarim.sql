-- ============================================================
-- ONARIM: "Profil Bulunamadı" hatası için tek seferlik düzeltme
-- Supabase Dashboard > SQL Editor'e yapıştırıp Run deyin.
-- ============================================================

-- 1) Uygulamanın (giriş yapmış kullanıcıların) tablolara erişim izni.
--    Satır bazlı güvenlik (RLS) aynen geçerli kalır; kim neyi görür
--    onu yine politikalar belirler.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- 2) Profili eksik kalmış kullanıcılar için profil kaydı oluştur
insert into public.profiles (id, email, full_name, role)
select u.id,
       coalesce(u.email, ''),
       coalesce(u.raw_user_meta_data ->> 'full_name', ''),
       'pending'::public.user_role
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 3) Rolleri ata (önce admin → "son yönetici koruması" takılmaz)
update public.profiles set role = 'admin'
  where lower(email) = 'yonetici@safirsitesi.com';
update public.profiles set role = 'sayman'
  where lower(email) = 'sayman@safirsitesi.com';
update public.profiles set role = 'muhasebeci'
  where lower(email) = 'muhasebeci@safirsitesi.com';

-- 4) Son durum: tüm kullanıcılar, e-posta doğrulaması ve rolleri
select u.email                                   as kullanici,
       (u.email_confirmed_at is not null)        as eposta_dogrulandi,
       (p.id is not null)                        as profil_var,
       p.role                                    as rol
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;
