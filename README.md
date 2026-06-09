# 🏢 Safir Sitesi Yönetim Paneli

Site aidat, gelir ve masraf takibi için **tamamen ücretsiz altyapıyla** çalışan,
mobil/tablet uyumlu web uygulaması.

| | |
|---|---|
| **Canlı adres** | https://codexagent61-spec.github.io/safir-sitesi/ |
| **Barındırma** | GitHub Pages (ücretsiz) |
| **Veritabanı + Giriş sistemi** | Supabase ücretsiz katmanı (500 MB veritabanı) |
| **Aylık maliyet** | **0 TL** — sunucu yok, tüm uygulama tarayıcıda çalışır |

---

## 🚀 İlk Kurulum (tek seferlik, ~5 dakika)

### 1) Veritabanını kur
1. [`supabase/migration.sql`](supabase/migration.sql) dosyasının içeriğini kopyalayın.
2. [Supabase SQL Editor](https://supabase.com/dashboard/project/erlmkdaqnmyanajxacwg/sql/new)
   sayfasını açın, yapıştırın, **Run** deyin.
3. En altta `Safir Sitesi veritabanı kurulumu tamamlandı ✔` mesajını görmelisiniz.

> Alternatif: bilgisayarda `npm run db:apply` (önce `DATABASE_URL` ortam değişkenine
> Supabase veritabanı bağlantı adresinizi şifrenizle yazın).

### 2) Supabase giriş ayarlarını yap
[Authentication → URL Configuration](https://supabase.com/dashboard/project/erlmkdaqnmyanajxacwg/auth/url-configuration)
sayfasında:
- **Site URL** alanına şunu yazın: `https://codexagent61-spec.github.io/safir-sitesi/`

Bu ayar, e-posta doğrulama ve şifre sıfırlama bağlantılarının doğru adrese dönmesi içindir.
İsterseniz [Authentication → Sign In / Providers → Email](https://supabase.com/dashboard/project/erlmkdaqnmyanajxacwg/auth/providers)
altından **Confirm email** seçeneğini kapatabilirsiniz; o zaman kullanıcılar e-posta
doğrulaması beklemeden giriş yapar (site içi kullanım için pratiktir).

### 3) İlk Yönetici hesabını aç
1. Canlı adresi açın → **Kayıt Ol** sekmesi → ad soyad, e-posta, şifre.
2. **Sisteme ilk kayıt olan kullanıcı otomatik olarak Yönetici olur.**
3. Sonraki kayıtlar "Onay Bekliyor" durumunda kalır; Yönetici, **Kullanıcılar**
   ekranından rol atar.

---

## 👥 Roller

| Rol | Yetki |
|---|---|
| **Yönetici (Admin)** | Tüm modüller: sakinler, aidat, masraf, ayarlar, kullanıcı yönetimi |
| **Sayman** | Yönetici ile birebir aynı yetkiler |
| **Muhasebeci** | Sadece yıl/ay seçip **masraf kayıtlarını Excel'e aktarır** ve o ayın **toplam aidat gelirini** görür. Sakinleri, ödemeleri, ayarları, kullanıcıları **göremez** |
| **Onay Bekliyor** | Hiçbir veriye erişemez (yeni kayıtların başlangıç durumu) |

Yetkiler yalnızca arayüzde değil, **veritabanı seviyesinde (Supabase RLS politikaları)**
de uygulanır: muhasebeci hesabıyla API'ye doğrudan istek atılsa bile sakin/ödeme
verisi dönmez. Muhasebecinin gördüğü aylık gelir toplamı, tek tek ödeme kayıtlarına
erişim vermeyen özel bir veritabanı fonksiyonundan (`monthly_income`) gelir.
Sistem ayrıca **son Yöneticinin silinmesini/rol düşürülmesini** veritabanı
trigger'ı ile engeller.

---

## 📖 Modüller

### 🏠 Sakinler
- Alanlar: **Blok-Daire No**, **Giriş Kat (Evet/Hayır — varsayılan Hayır)**, **İsim**, **Soyisim**
- Tek tek ekleme/düzenleme/silme
- **Excel'den toplu içe aktarım** (önizleme + hata raporuyla; mevcut daireler güncellenir),
  **Excel'e dışa aktarım**, hazır **şablon indirme**
- Ödemesi bulunan sakin yanlışlıkla silinemez (önce ödemeleri silinmelidir)

### 💰 Aidat Takibi
- Dönem (yıl/ay) seçilir; her sakin için **aidat / ödenen / gecikme faizi / kalan / durum** görünür
- **Ödeme Al**: banka veya elden tahsilat; tutar, tarih, not; "Kaydet ve Sonraki Ay" ile
  art arda aylar hızlıca girilir
- **Ekstre**: sakinin tüm dönemlerinin dökümü ve toplam borcu
- **Ödemeler** sekmesi: dönemin tüm tahsilat kayıtları, yanlış kayıt silme

### 🧾 Masraflar (VUK uyumlu)
- Alanlar: Belge Türü (Fatura/Fiş), Firma Ünvanı, **Vergi No (10 hane) / TC Kimlik No (11 hane)**
  (kontrol basamağı doğrulanır), Belge Tarihi, Belge No, **Matrah**, **KDV Oranı**, **KDV Tutarı**
  (otomatik hesaplanır, kuruş farkı elle düzeltilebilir), **Toplam** (Matrah + KDV, otomatik)
- Veritabanı `Toplam = Matrah + KDV` eşitliğini ayrıca denetler
- Dönem bazlı listeleme ve **tüm VUK alanlarıyla Excel'e aktarım** (toplam satırı dahil)

### ⚙️ Ayarlar (yalnız Yönetici/Sayman)
- **Kat bazlı aidat**: normal daire ve giriş kat daire için ayrı tutar; seçilen yıl/aydan
  itibaren geçerli (geçmiş tarifeler korunur, tarih bazlı hesaplanır)
- **Gecikme faizi**: yıl + ay (varsayılan **Mart**) seçimiyle aylık % oran; oranlar
  Mart'tan Mart'a değiştiğinde geçmiş dönemler kendi oranıyla hesaplanmaya devam eder
- **Son ödeme günü**: 1–31 (31 girilirse kısa aylarda "ayın son günü" kabul edilir)

### 📊 Özet (Dashboard)
- Bu ay toplanan aidat, bu yıl toplam, **toplam geciken borç (faiz dahil)**, bu ay masraf
- Son 6 ayın gelir/masraf grafiği ve en borçlu sakinler listesi
- Eksik kurulum adımları için yönlendirme uyarıları

---

## 🧮 Gecikme Faizi Nasıl Hesaplanır?

1. Her dönemin aidatı, **son ödeme gününe** kadar ödenmelidir (kısa aylarda güne
   sığmıyorsa ayın son günü).
2. Vadeden sonra kalan **anapara** üzerinden günlük faiz işler:
   `günlük oran = o takvim ayında geçerli aylık oran ÷ 30` (kıst esası).
3. Takvim ayı değişince o ayın oranı uygulanır (ör. Mart'ta oran değiştiyse
   Şubat günleri eski, Mart günleri yeni oranla işler).
4. Ödemeler **önce birikmiş faize, sonra anaparaya** sayılır; faize faiz işletilmez.

Örnek: 1.000 TL aidat, vade 31 Ocak, aylık %3 → 2 Mart'ta borç
1.000 + (1.000 × %3 ÷ 30 × 30 gün) = **1.030 TL**.

---

## 📂 Excel Biçimleri

**Sakin içe aktarma** (ilk satır başlık):

| Blok-Daire No | Giriş Kat (Evet/Hayır) | İsim | Soyisim |
|---|---|---|---|
| A Blok - 1 | Hayır | Ahmet | Yılmaz |

"Ad/Soyad" gibi başlık varyasyonları da tanınır; boş Giriş Kat "Hayır" sayılır.
Hatalı satırlar içe aktarım öncesi satır numarasıyla raporlanır.

**Masraf dışa aktarma**: Belge Türü, Firma Ünvanı, Vergi/TC Kimlik No (metin olarak,
baştaki sıfırlar korunur), Belge Tarihi, Belge No, Matrah, KDV Oranı, KDV Tutarı,
Toplam Tutar, Açıklama + TOPLAM satırı.

---

## 🛠️ Teknik

- **Önyüz**: React 18 + TypeScript + Vite + Tailwind CSS v4 (tamamı statik, GitHub Pages'te)
- **Arka uç**: Supabase (PostgreSQL + Auth + RLS) — ayrı sunucu yok
- **Excel**: SheetJS (tarayıcıda çalışır, dosyalar hiçbir sunucuya yüklenmez)
- Para hesapları **kuruş (tam sayı)** üzerinden yapılır; kayan nokta hatası borçlara yansımaz

```bash
npm install        # bağımlılıklar
npm run dev        # geliştirme sunucusu (http://localhost:5173)
npm test           # birim testleri (faiz motoru, VUK doğrulamaları, Excel, roller)
npm run build      # üretim derlemesi (dist/)
npm run db:apply   # migration.sql'i DATABASE_URL'e uygular (isteğe bağlı)
```

`main` dalına her push'ta GitHub Actions testleri çalıştırır, uygulamayı derler ve
GitHub Pages'e dağıtır (`.github/workflows/deploy.yml`).

Test planı ve elle doğrulama kontrol listesi için: [TEST_PLAN.md](TEST_PLAN.md)

---

## ❓ Sık Sorulanlar

**Ücretsiz katmanın sınırı ne?** Supabase ücretsiz projeler ~1 hafta hiç
kullanılmazsa uyku moduna alınır. Panele girilemiyorsa
[Supabase Dashboard](https://supabase.com/dashboard/project/erlmkdaqnmyanajxacwg) →
**Restore project** ile birkaç dakikada geri açılır. Düzenli kullanılan projede bu yaşanmaz.

**Kullanıcıyı tamamen nasıl silerim?** Kullanıcılar ekranı rolü "Onay Bekliyor"a
çekerek erişimi kapatır. Hesabı kalıcı silmek için: Supabase Dashboard →
Authentication → Users → ilgili kullanıcı → Delete user.

**Yedek almalı mıyım?** Sakinler ve Masraflar ekranlarındaki Excel dışa aktarımları
hızlı yedektir. Ayrıca Supabase Dashboard → Database → Backups günlük yedek tutar.

**Verileri kim görebilir?** Kod herkese açık bir depoda dursa da veriler Supabase'tedir;
RLS politikaları gereği yalnızca rol atanmış kullanıcılar erişebilir. Koddaki
`publishable` anahtar istemcilerde kullanılmak üzere tasarlanmıştır ve tek başına
veri erişimi sağlamaz.
