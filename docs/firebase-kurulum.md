# Firebase kurulumu (adım adım)

Bu belge, sitenin **ziyaret istatistiklerini**, **ziyaretçi defterini** ve **mini oyun skor tablosunu**
çalıştırmak için gereken Firebase kurulumunu anlatır. Kod yazmana gerek yok; yaklaşık 15 dakika sürer.

Kurulum yapılmadan da site sorunsuz çalışır ("yerel mod"): yalnızca istatistik toplanmaz, ziyaretçi
defterine mesaj bırakılamaz ve skor tablosu yalnızca o tarayıcıda tutulur.

> **Konsol dili:** Firebase konsolunun menü adları dile göre değişebilir. Bu belgede her menü
> "Türkçe (English)" biçiminde, yani **Kurallar (Rules)** gibi yazıldı; hangisini görüyorsan onu ara.

## Özet kontrol listesi

- [ ] 1. Firebase projesi oluşturuldu (Google Analytics kapalı).
- [ ] 2. Firestore veritabanı **üretim modunda (production mode)** ve Avrupa bölgesinde açıldı.
- [ ] 3. Authentication'da **Google** girişi açıldı.
- [ ] 4. Web uygulaması eklendi; 4 değer (`apiKey`, `authDomain`, `projectId`, `appId`) `src/data/config.js` içine yapıştırıldı ve site yeniden yayınlandı.
- [ ] 5. `firestore.rules` içeriği **Kurallar (Rules)** sekmesine yapıştırılıp **Yayınla (Publish)**'e basıldı.
- [ ] 6. İki bileşik dizin oluşturuldu ve **Enabled / Etkin** oldu: `guestbook` ve `scores`.
- [ ] 7. Yetkili alan adlarında `localhost` ve `ismailsamib.github.io` var.
- [ ] 8. `https://ismailsamib.github.io/portfolyo/?admin` adresinde giriş yapılıp panel görüldü.
- [ ] 9. Güvenlik ayarları gözden geçirildi (Anonim ve E-posta/Parola kapalı, Spark planda kalındı).

> **apiKey gizli değildir.** Firebase'in verdiği `apiKey` ve diğer değerler bir parola değil, projenin
> "adresi"dir; sitenin kodunda herkese açık durması normaldir. Verini koruyan şey 5. adımda yayınlayacağın **güvenlik kurallarıdır**. O adımı atlama.

---

## 1) Firebase projesi oluştur

1. <https://console.firebase.google.com> adresine **`<yönetici e-postan>`** (yönetici olacak Google hesabın) ile gir.
2. **Proje ekle / Create a project**'e tıkla (Türkçe konsolda "Proje oluştur" da yazabilir).
3. Bir ad ver (ör. `kisisel-site`).
4. Google Analytics sorulursa **kapat** (gerek yok) ve projeyi oluştur.

**Doğru yaptıysan:** Projenin ana sayfası açılır ve sol üstte proje adını (`kisisel-site`) görürsün.

## 2) Firestore veritabanını aç

1. Sol menüden **Derleme > Firestore Database (Build > Firestore Database)**'e gir,
   **Veritabanı oluştur (Create database)**'e tıkla.
2. Sürüm sorulursa **Standard** seç.
3. Konum (location): Avrupa'da bir bölge seç. Öneri: **`eur3 (Europe)`**; listede yoksa
   **`europe-west3 (Frankfurt)`** ya da başka bir `europe-west` bölgesi. *Konum sonradan değiştirilemez.*
4. Güvenlik kuralları sorulunca **Üretim modunda başlat (Start in production mode)** seç
   (test modu DEĞİL) ve oluştur.

**Doğru yaptıysan:** Firestore sayfasında "Veri (Data)" sekmesi boş bir veritabanıyla açılır.

## 3) Google ile girişi aç

1. Sol menüden **Derleme > Authentication (Build > Authentication)**'a gir,
   **Başlayın (Get started)**'a tıkla.
2. **Oturum açma yöntemi (Sign-in method)** sekmesinde **Google**'ı seç, **Etkinleştir (Enable)**'i aç.
3. Destek e-postası olarak kendi adresini seç ve **Kaydet (Save)**'e bas.

Bu giriş yalnızca senin yönetici paneline girmen içindir; ziyaretçiler giriş yapmaz.

**Doğru yaptıysan:** Sağlayıcı listesinde Google'ın yanında **Etkin / Enabled** yazar.

## 4) Web uygulaması ekle ve ayarları siteye yapıştır

1. Sol üstteki dişli > **Proje ayarları > Genel (Project settings > General)** sayfasına gir.
2. En altta **Uygulamalarınız (Your apps)** bölümünde **`</>` (Web)** simgesine tıkla.
3. Bir takma ad ver (ör. `site`). **Firebase Hosting** kutusunu işaretleme.
   **Uygulamayı kaydet (Register app)**'e bas.
4. Ekranda `firebaseConfig = { ... }` diye bir blok görünür. İçindeki şu **dört değeri** kopyala ve
   `src/data/config.js` dosyasındaki boş tırnakların arasına yapıştır: `apiKey`, `authDomain`,
   `projectId`, `appId`. Dosya aşağıdaki gibi görünmeli. Bu değerler gizli değildir.

   ```js
   export const firebaseConfig = {
     apiKey: 'AIza...',
     authDomain: 'kisisel-site.firebaseapp.com',
     projectId: 'kisisel-site',
     appId: '1:1234567890:web:abcdef...',
   };
   ```

   Diğer alanları (`storageBucket`, `messagingSenderId`, `measurementId`) eklemene gerek yok.
5. Dosya kaydedilip site yeniden derlenerek yayınlandığında uzak mod devreye girer.

**Doğru yaptıysan:** Yayınlanan sitede `?admin` adresi artık "Firebase henüz bağlanmadı" yerine
"Giriş" ekranını gösterir.

## 5) Güvenlik kurallarını yayınla (en önemli adım)

1. **Firestore Database > Kurallar (Rules)** sekmesine gir.
2. Kutudaki her şeyi sil.
3. Proje klasörünün kökündeki **`firestore.rules`** dosyasının tüm içeriğini kopyalayıp yapıştır.
4. **Yayınla (Publish)**'e bas.

Bu kurallar şunu sağlar:

- Ziyaretçiler yalnızca **yeni olay**, **onay bekleyen defter mesajı** ve **skor** ekleyebilir;
  mevcut hiçbir kaydı değiştiremez ya da silemez. Eklenen kayıtların alanları, türleri ve
  uzunlukları kurallarda sabittir; fazladan alan içeren kayıt reddedilir. Olay saati en çok 5 dakika
  ileride olabilir (bilgisayar saati çok ileri olan bir ziyaretçinin istatistiği kaydedilmez), skor
  en çok 3000'dir (oyunun ulaşılabilir tavanı ~2870), belge kimlikleri sitenin kendi ürettiği
  20 harf/rakamlık biçimde olmalıdır, defter adı tek satır olmalıdır.
- Ziyaretçiler yalnızca **onaylanmış defter mesajlarını** (en çok 50) ve **skor tablosunu** (en çok
  10 satır, sayfalama/atlama olmadan) okuyabilir. Olaylar (istatistikler) ve onay bekleyen mesajlar
  onlara kapalıdır.
- İstatistikleri okumak, mesajları onaylamak/silmek ve skorları silmek yalnızca
  **`<yönetici e-postan>`** hesabına açıktır (Google ile girilmiş ve e-postası doğrulanmış olmalı;
  normal Gmail hesabında zaten öyledir). Bu adres iki yerde yazılıdır ve aynı olmalıdır:
  `firestore.rules` içinde `isAdmin()` fonksiyonunda ve `src/data/config.js` içinde `ADMIN_EMAIL`.

Yönetici adresini değiştirmek istersen bu iki yeri birlikte değiştir, sonra kuralları yeniden yayınla.

**Doğru yaptıysan:** Kurallar sekmesinde üstte "Yayınlandı / Published" ve yeni bir tarih görünür;
yapıştırdığın metin `rules_version = '2';` ile başlar.

## 6) Bileşik dizinleri oluştur

Kod iki sorguda hem filtre hem sıralama kullanır; Firestore bunlar için elle dizin ister. **İki dizin**
gerekir. Her biri için: **Firestore Database > Dizinler > Bileşik (Indexes > Composite)** sekmesinde
**Dizin ekle / Dizin oluştur (Add index / Create index)**'e tıkla.

**Dizin 1: ziyaretçi defteri** (onaylı mesajları yeniden eskiye listeler)

- **Collection ID:** `guestbook`
- **Alan 1:** `status` — **Artan (Ascending)**
- **Alan 2:** `createdAt` — **Azalan (Descending)**
- **Query scope:** Collection (Koleksiyon)

**Dizin 2: skor tablosu** (skor büyükten küçüğe, eşitlikte eski olan önce)

- **Collection ID:** `scores`
- **Alan 1:** `score` — **Azalan (Descending)**
- **Alan 2:** `at` — **Artan (Ascending)**
- **Query scope:** Collection (Koleksiyon)

İkisinde de **Oluştur (Create)**'e bas. Durum birkaç dakika içinde "Building / Oluşturuluyor"dan
**Enabled / Etkin**'e döner.

Başka dizin gerekmez: `events` (yalnızca `at` ile süzülüp sıralanır) ve yöneticinin defter listesi
(yalnızca `createdAt` ile sıralanır) tek alanlı sorgulardır, Firestore bunları kendisi yönetir.

Dizin yokken ziyaretçi defteri boş görünür, skor tablosu da uzaktan okunamaz ve tarayıcıdaki yerel
tabloya düşer; bu normaldir. Konsoldaki hata iletisinde dizini tek tıkla oluşturan bir bağlantı da
çıkar. Skorlar `scores` koleksiyonunda tutulur: herkes okuyabilir ve (3 harf/rakam rumuz, 0-3000 skor)
ekleyebilir; yalnızca yönetici silebilir (yönetici panelindeki "Skor tablosu" bölümü).

**Doğru yaptıysan:** Bileşik dizin listesinde `guestbook` ve `scores` için iki satır görünür ve
ikisinin de durumu **Enabled / Etkin** olur.

## 7) Yetkili alan adlarını ekle

1. **Authentication > Ayarlar > Yetkili alanlar (Authentication > Settings > Authorized domains)**
   bölümüne gir.
2. Listede **`localhost`** olduğundan emin ol (varsayılan listede hazır gelir; yoksa
   **Alan adı ekle (Add domain)** ile ekle).
3. **Alan adı ekle (Add domain)** ile **`ismailsamib.github.io`** yaz ve ekle. Yalnızca alan adını
   yaz; `https://` ya da `/portfolyo/` ekleme.

Bu yapılmazsa "Google ile giriş yap" penceresi hata verir.

**Doğru yaptıysan:** Listede `localhost` ve `ismailsamib.github.io` satırları görünür.

## 8) Yönetici paneline gir

1. Site adresinin sonuna `?admin` ekle:
   - Yayındaki site: `https://ismailsamib.github.io/portfolyo/?admin`
   - Kendi bilgisayarında: `http://localhost:5173/?admin`
2. **Google ile giriş yap**'a tıkla ve **`<yönetici e-postan>`** hesabını seç.
3. Panelde özet kartları, günlük ziyaret grafiği, şirket etiketleri (`?ref=SirketAdi`), oturumlar,
   skor tablosu ve ziyaretçi defteri (onay bekleyen / yayındaki mesajlar) görünür.

Açılır pencere engellenirse tarayıcının adres çubuğundaki uyarıdan bu site için pencerelere izin ver.

**Doğru yaptıysan:** Sayfanın üstünde "Yönetici Paneli" başlığı ve e-posta adresin ile **Çıkış yap**
düğmesi görünür. Henüz ziyaret yoksa "Bu aralıkta kayıtlı olay yok." yazması normaldir.

## 9) Güvenlik ayarları

- **Yetkili alan adı (7. adım):** yalnızca tam `ismailsamib.github.io` yazılır, asla `github.io`
  (o, başkalarının sitelerine de giriş izni verir).
- **Giriş yöntemleri (Authentication > Sign-in method):** yalnızca **Google** açık kalır. **Anonim
  (Anonymous)** ve **E-posta/Parola (Email/Password)** kapalı olmalı.
- **Plan:** **Spark (ücretsiz)** planda kal. Blaze'e geçersen mutlaka bütçe uyarısı kur
  (Google Cloud Console > Faturalandırma > Bütçeler ve uyarılar / Billing > Budgets & alerts).
- **Yeni hesap oluşturmayı kapat:** yönetici girişini bir kez yaptıktan sonra
  **Authentication > Ayarlar > Kullanıcı işlemleri (Settings > User actions)** altında yeni hesap
  oluşturmayı kapatma seçeneği varsa kapat. Bu seçenek ücretsiz planda bulunmayabilir; yoksa atla
  (kurallar zaten yalnızca yönetici hesabına yetki verir).
- **API anahtarı kısıtı (isteğe bağlı):** Google Cloud Console > **API'ler ve Hizmetler > Kimlik
  bilgileri (APIs & Services > Credentials)** sayfasında tarayıcı API anahtarına **HTTP yönlendiren
  (HTTP referrers)** kısıtı koy ve şu üçünü ekle:
  - `https://ismailsamib.github.io/*`
  - `https://<proje-kimliği>.firebaseapp.com/*` (**bunu eklemezsen Google ile giriş bozulur**; `<proje-kimliği>`, `projectId` değeridir)
  - `http://localhost:5173/*`

**Doğru yaptıysan:** Sign-in method listesinde yalnızca Google "Etkin / Enabled"dır.

---

## Hangi veri toplanıyor?

Yalnızca anonim kullanım olayları: sayfa açılışı, hangi eşyaya/bölüme dokunulduğu, tur, CV indirme,
dış bağlantı tıklaması (alan adı ve yol), mini oyun skoru, oturum süresi, dil, cihaz türü
(mobil/masaüstü), görünüm (oyun/klasik) ve bağlantıdaki `?ref=` etiketi.

Toplanmayanlar: IP adresi, tarayıcı bilgisi (user agent), ad, e-posta, konum. "Ziyaretçi" sayısı,
tarayıcıda saklanan rastgele bir kimlikle hesaplanır; kişiyi tanımlamaz. Yönetici panelindeki kendi
gezinmen sayılmaz. (Ziyaretçi defterine ve skor tablosuna yazılan ad/rumuz ise ziyaretçinin kendi
isteğiyle bıraktığı bilgidir.)

## Ücretsiz plan (Spark) sınırları

Kredi kartı gerekmez. Sınırlar Firebase tarafından değiştirilebilir; güncel değerler için
<https://firebase.google.com/pricing> sayfasına bak. Yazıldığı tarihte Firestore için günlük sınırlar:

| Kaynak | Günlük ücretsiz sınır |
| --- | --- |
| Belge okuma | 50.000 |
| Belge yazma | 20.000 |
| Belge silme | 20.000 |
| Depolama | 1 GiB (toplam) |

Bu site için anlamı:

- Her ziyaretçi oturumu en çok ~300 olay (yazma) üretebilir; tipik bir oturum 10-30 olaydır. Günde
  yüzlerce ziyaret rahatça sığar.
- Yönetici panelini her açışın ya da **Yenile**'ye her basışın, seçili aralıktaki olay sayısı kadar
  **okuma** harcar (en çok 5.000; ayrıca en çok 200 skor ve 500 defter mesajı). Günde birkaç kez
  bakmak sorun olmaz; art arda onlarca kez yenilemek günlük okuma sınırını doldurabilir.
- Sınır aşılırsa site bozulmaz: o gün için istatistik yazılmaz/okunmaz, ertesi gün kendiliğinden düzelir.

## Sorun giderme

| Belirti | Olası neden |
| --- | --- |
| Panelde "Firebase henüz bağlanmadı" | `src/data/config.js` boş ya da site yeniden yayınlanmadı (4. adım). |
| Giriş penceresi açılıp hata veriyor | Alan adı yetkili değil (7. adım) ya da Google sağlayıcısı kapalı (3. adım). |
| "Bu hesabın yetkisi yok" | Yanlış Google hesabıyla girdin; çıkış yapıp doğru hesabı seç. |
| "Erişim reddedildi" | Kurallar yayınlanmamış ya da eski (5. adım). |
| "Sorgu için dizin eksik" | 6. adımdaki iki dizinden biri eksik ya da hâlâ "Building" durumunda. |
| Ziyaretçi defteri hep boş | Dizin henüz hazır değil (6. adım) ya da onaylanmış mesaj yok. |
| Skor tablosu yalnızca kendi skorlarımı gösteriyor | `scores` dizini hazır değil (6. adım); tablo yerel moda düşmüş. |
| Panelde hiç olay yok | Kurallar yayınlanmadan önceki ziyaretler kaydedilmez; siteyi normal adresinden (`?admin` olmadan) bir kez gez, 10 saniye bekle, paneli yenile. |
