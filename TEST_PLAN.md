# ✅ Test Planı – Safir Sitesi Yönetim Paneli

## 1) Otomatik Birim Testleri (`npm test`)

Her push'ta GitHub Actions üzerinde de çalışır; **testler geçmeden dağıtım yapılmaz**.

| Dosya | Kapsam |
|---|---|
| `src/lib/interest.test.ts` | Faiz motoru: vadeden önce/vadede/geç ödeme, 30 gün gecikme = aylık oran, ay ortasında oran değişimi, ödemenin önce faize sayılması, kısmi ödeme, fazla ödeme, kısa ay (28/29 Şubat) kıstırması, tarife/oran tanımsızlık durumları, tarife seçim kuralı |
| `src/lib/validation.test.ts` | TCKN kontrol basamağı (geçerli/geçersiz/0 ile başlayan), VKN kontrol basamağı, form kuralları (10-11 hane, uyarı/engel ayrımı), KDV yuvarlama |
| `src/lib/excel.test.ts` | Sakin içe aktarımı: standart şablon, başlık varyasyonları, hatalı satır raporlama, boş satır atlama; masraf dışa aktarımı: tüm VUK kolonları, TOPLAM satırı, baştaki sıfırların korunması |
| `src/lib/core.test.ts` | Tarih aritmetiği (artık yıl, ay sınırı), Türkçe para girişi ayrıştırma (binlik/ondalık), rol → sayfa erişim matrisi |

## 2) Rol Bazlı Erişim – Elle Doğrulama

Üç hesap açın (Yönetici, Sayman, Muhasebeci — roller Kullanıcılar ekranından atanır).

### Muhasebeci hesabıyla (kritik sınır):
- [ ] Girişte doğrudan **Muhasebe** ekranı açılır; menüde başka modül yoktur
- [ ] Adres çubuğuna `#/sakinler`, `#/aidat`, `#/ayarlar`, `#/kullanicilar` yazınca
      Muhasebe ekranına geri yönlendirilir
- [ ] Dönem seçince **Toplam Aidat Geliri** görünür; masraf listesi salt okunurdur
      (ekle/düzenle/sil düğmesi yoktur)
- [ ] **Excel'e Aktar** seçilen ayın masraflarını tüm VUK alanlarıyla indirir
- [ ] **API (RLS) testi**: muhasebeci oturumunun erişim token'ı ile Supabase REST
      uç noktasına (`/rest/v1/residents` veya `/rest/v1/payments`) GET isteği atıldığında
      **boş sonuç** dönmelidir; `/rest/v1/expenses` ise veri döndürür. Yani kısıt,
      arayüzde değil veritabanında uygulanır.

### Onay bekleyen hesapla:
- [ ] Yalnızca "Hesabınız Onay Bekliyor" ekranı görünür; hiçbir veri yüklenmez

### Yönetici/Sayman hesabıyla:
- [ ] Tüm modüller açılır ve CRUD işlemleri çalışır
- [ ] Kullanıcılar ekranında kendi rolü kilitlidir
- [ ] Tek yönetici varken rolünü düşürme denemesi veritabanı hatasıyla engellenir
      ("Sistemdeki son Yöneticinin rolü değiştirilemez")

## 3) Aidat / Faiz Senaryoları – Elle Doğrulama

Hazırlık: Ayarlar → tarife (örn. normal 1.000 TL, giriş kat 800 TL, Ocak'tan itibaren),
faiz %3 (Mart'tan itibaren), son ödeme günü 31.

- [ ] **Senaryo A (zamanında ödeme)**: Ocak döneminde 1.000 TL ödeme, tarih 31 Ocak →
      durum "Ödendi", faiz 0
- [ ] **Senaryo B (30 gün gecikme)**: Ocak dönemi hiç ödenmemişken bilgisayar tarihiyle
      2 Mart'ta bakıldığında kalan = **1.030,00 TL** (1.000 + 30 gün × 1 TL/gün)
- [ ] **Senaryo C (kısmi ödeme)**: 10 Şubat'ta 500 TL girilir → ekstre: ödenen 500,
      faizden 10 TL düşülmüş, kalan anapara 510 TL üzerinden faiz işlemeye devam eder
- [ ] **Senaryo D (giriş kat)**: giriş kat işaretli sakinin tahakkuku 800 TL'dir
- [ ] **Senaryo E (tarife değişimi)**: Mart'tan itibaren yeni tarife eklenince Ocak-Şubat
      eski, Mart+ yeni tutardan hesaplanır (ekstreden kontrol edin)
- [ ] Ödeme silindiğinde tüm tutarlar otomatik geri hesaplanır

## 4) Masraf / VUK Doğrulamaları

- [ ] 9 haneli vergi no kaydedilemez (hata mesajı)
- [ ] Geçersiz TCKN (örn. 12345678901) kesin engellenir
- [ ] Kontrol basamağı tutmayan 10 haneli VKN'de uyarı çıkar, onaylanırsa kaydedilir
- [ ] Matrah 1.000 + %20 → KDV 200, Toplam 1.200 otomatik dolar; KDV elle 199,99
      yapılırsa Toplam 1.199,99 olur (eşitlik daima korunur)
- [ ] Excel çıktısında tüm kolonlar dolu, sondaki TOPLAM satırı doğru toplar

## 5) Excel İçe Aktarım

- [ ] Şablon indirilir, 3-4 satır doldurulur, içe aktarılır → önizlemede "Yeni" rozeti
- [ ] Aynı dosya ikinci kez aktarılınca "Güncellenecek" rozeti görünür, kayıt çoğalmaz
- [ ] Daire no boş / Giriş Kat "belki" yazan satırlar satır numarasıyla hatalı listelenir
      ve aktarım dışı kalır

## 6) Duyarlı Tasarım

- [ ] Telefon genişliğinde (≤400px) menü hamburger'e dönüşür, tablolar yatay kaydırılır
- [ ] Tüm formlar dokunmatik kullanım için yeterli büyüklükte (44px+ hedefler)

## 7) Dağıtım Hattı (CI/CD)

- [ ] `main`'e push → GitHub Actions: `npm ci` → `npm test` → `npm run build` → Pages dağıtımı
- [ ] Test kırmızıysa dağıtım durur (build job'u başarısız olur)
