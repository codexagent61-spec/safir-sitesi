-- ============================================================
-- Rol atama: yonetici / sayman / muhasebeci @safirsitesi.com
-- Supabase Dashboard > SQL Editor'e yapıştırıp Run deyin.
-- (Önce admin atanır; böylece "son yönetici koruması" devreye girmez.)
-- ============================================================

update public.profiles set role = 'admin'
  where lower(email) = 'yonetici@safirsitesi.com';

update public.profiles set role = 'sayman'
  where lower(email) = 'sayman@safirsitesi.com';

update public.profiles set role = 'muhasebeci'
  where lower(email) = 'muhasebeci@safirsitesi.com';

-- Kontrol: üç kullanıcı ve rolleri aşağıda listelenmeli
select email, role, created_at
from public.profiles
order by created_at;
