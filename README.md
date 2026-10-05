# İsmail Sami Başaraner · Portfolyo

Pixel-art bir odada gezerek projeleri, deneyimi ve eğitimi keşfettiğiniz, oyunlaştırılmış kişisel portfolyo sitesi. İsteyenler için aynı içeriğin düz sayfa hali olan **klasik görünüm** de var.

Canlı adres: <https://ismailsamib.github.io/portfolyo/>

## Yerelde çalıştırma

```bash
npm install
npm run dev      # geliştirme sunucusu (http://localhost:5173)
npm run build    # üretim derlemesi: dist/
npm run preview  # derlemeyi yerelde önizle
```

Node 22 ile test edilir. Görselleri yeniden optimize etmek için `npm run images` (sharp kullanır).

## Klasör yapısı

```
index.html        Giriş sayfası ve meta etiketleri
src/
  main.js         Uygulama girişi
  scenes/         Phaser sahneleri (açılış, oda)
  game/           Oda ve pixel-art çizim kodu
  ui/             HUD, paneller, diyalog, klasik görünüm
  content/        Metinler ve proje verileri
  data/           Firebase ve istatistik katmanı
  admin/          Yönetim paneli
public/           Statik dosyalar (görseller, og-cover.jpg)
scripts/          Görsel optimizasyon ve logo pikselleştirme araçları
docs/             Kurulum belgeleri
firestore.rules   Firestore güvenlik kuralları
```

Site, `main` dalına yapılan her push'ta GitHub Actions ile (`.github/workflows/deploy.yml`) GitHub Pages'e yayınlanır.

## Firebase kurulumu

Ziyaret istatistikleri ve ziyaretçi defteri Firebase kullanır. Kurulum yapılmadan site "yerel mod"da sorunsuz çalışır. Adım adım anlatım için [docs/firebase-kurulum.md](docs/firebase-kurulum.md) dosyasına bakın.

## Yazı tipleri

Yazı tipleri [Jersey 10 ve Jersey 15](https://fonts.google.com/?query=Jersey) (SIL Open Font License). Dosyalar `public/assets/fonts/` içinde durur ve siteden yüklenir (`src/style.css` içindeki `@font-face` kuralları); gövde metni Jersey 10, başlık ve veri metni Jersey 15 ile gösterilir.

## Görsel kaynakları ve atıflar

- **Gdańsk University of Technology logosu:** Wikimedia Commons, yükleyen Asas077, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Siteye pikselleştirilmiş (değiştirilmiş) bir türev olarak alınmıştır; türev eser aynı lisansla paylaşılır. Kaynak: <https://commons.wikimedia.org/wiki/File:Logo_Gda%C5%84sk_University_of_Technology.svg>
- **Yıldız Teknik Üniversitesi logosu:** Wikimedia Commons'tan alınmıştır (kamu malı olarak işaretli). Logo tescilli bir markadır ve marka hakları Yıldız Teknik Üniversitesi'ne aittir; sitede yalnızca kimlik/eğitim bilgisini göstermek amacıyla kullanılmıştır. Kaynak: <https://commons.wikimedia.org/wiki/File:Y%C4%B1ld%C4%B1z_Technical_University_logo.svg>
- **Deptron ve AITT logoları:** İlgili takımların LinkedIn şirket sayfalarından alınmıştır; logolar takımlara aittir ve yalnızca kimlik belirtme amacıyla (pikselleştirilmiş olarak, proje kartı kapaklarında da) kullanılmıştır.

---

## English summary

A gamified pixel-art personal portfolio: walk around a room to explore projects, experience and education. A plain "classic view" of the same content is also available. Built with Vite and Phaser 3 (vanilla JS) and deployed to GitHub Pages at <https://ismailsamib.github.io/portfolyo/>. Run locally with `npm install` and `npm run dev`. Fonts: Jersey 10 / Jersey 15 (OFL); the Gdańsk Tech logo is CC BY-SA 3.0 (Asas077, Wikimedia Commons), and the YTU logo is a registered trademark used for identification only.
