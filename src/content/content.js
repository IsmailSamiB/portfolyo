// Sitedeki tüm kişisel içerik buradan düzenlenir.
// Metinler { tr: '...', en: '...' } biçimindedir; iki dili de doldur.
// Şema: profile, projects (tags[]: teknoloji/özel adlar düz dizgi, Türkçe etiketler { tr, en }), skills, experience, activities, education, certificates, contact, hometown, erasmus (başlık + metin; Gdańsk kartpostalı).
// education[].logo: okul logosu yolu (isteğe bağlı, Eğitim sekmesinde gösterilir). skills[].kind: özel grup türü (örn. 'languages').
// Yetenek seviyeleri 1-5 arasıdır: 1 temel/öğreniyorum, 2 gelişiyor, 3 rahat kullanıyorum, 4 iyi, 5 çok iyi.
// Projeler burada herhangi bir sırada durabilir; ekranda tarihe göre (yeniden eskiye) sıralanır
// (bkz. src/content/projects.js). date: 'YYYY-AA-GG'.

export default {
  profile: {
    name: 'İsmail Sami Başaraner',
    title: { tr: 'İstatistik Lisans Öğrencisi', en: 'Undergraduate Statistics Student' },
    tagline: {
      tr: 'Veriyle çalışmayı öğrenen, ekip işine ve organizasyona yatkın bir istatistik öğrencisiyim.',
      en: 'A statistics student learning to work with data, comfortable with teamwork and organising.',
    },
    bio: {
      tr: [
        "Merhaba! Ben İsmail. Yıldız Teknik Üniversitesi’nde İstatistik okuyorum; 2026 bahar dönemini Erasmus+ ile Gdańsk Teknik Üniversitesi’nde geçirdim.",
        "Eğitim hayatım boyunca kendimi geliştirebileceğim fırsatları değerlendirmeye önem verdim: lisede arkadaşlarımla İHA takımı kurduk, üniversitede kulüp yönetiminde ve sponsorluk görüşmelerinde yer aldım, yazın veri analizi stajı yaptım.",
        "Ekip çalışmasına uyum sağlayan, öğrenmeye açık biriyim. Veri analizi araçlarında (R, SQL) hâlâ öğrenme aşamasındayım ve bunu saklamıyorum; her projede bir adım ileri gitmeye çalışıyorum.",
      ],
      en: [
        "Hi! I’m İsmail. I study Statistics at Yıldız Technical University and spent the spring 2026 term at Gdańsk University of Technology through Erasmus+.",
        "I try to take every chance to grow: in high school my friends and I founded a UAV team, at university I joined a club’s executive board and took part in sponsorship talks, and I spent a summer as a data analysis intern.",
        "I work well in teams and I am open to learning. I am still a beginner with data analysis tools (R, SQL), and I would rather be upfront about that; I try to get one step better with every project.",
      ],
    },
    location: { tr: 'İstanbul, Türkiye', en: 'Istanbul, Türkiye' },
    // CV PDF’leri hazır olunca geri eklenecek (düğme kendiliğinden görünür), örn:
    // cvUrl: { tr: './cv-tr.pdf', en: './cv-en.pdf' },
    photo: './assets/ui/photo.webp', // gerçek fotoğraf (klasik görünüm)
    portrait: './assets/ui/portrait.webp', // pixel portre (oyun içi)
    highlights: [
      { tr: 'SGK Bursa İl Müdürlüğü’nde veri analizi stajı', en: 'Data analysis internship at the SGK Bursa Provincial Directorate' },
      { tr: 'İstanbul raylı sistemlerinin 2025 yolcu verisi üzerine açık kaynak analiz', en: 'Open-source analysis of Istanbul’s 2025 rail ridership data' },
      { tr: 'Deptron ile ilk senemizde TEKNOFEST finalinde derece', en: 'Placed in the TEKNOFEST finals with Deptron in our first year' },
      { tr: 'Erasmus+ ile Gdańsk Teknik Üniversitesi’nde bir dönem', en: 'One term at Gdańsk University of Technology through Erasmus+' },
      { tr: 'MİNT Kulübü’nde sponsorluk koordinatörlüğü ve yönetim kurulu üyeliği', en: 'Sponsorship coordinator and executive board member at MİNT Club' },
      { tr: 'Sertifikalı İHA pilotu', en: 'Certified UAV pilot' },
    ],
    // Klasik görünümdeki "sayılarla" kutuları
    stats: [
      { value: { tr: '1,06 milyar', en: '1.06 billion' }, label: { tr: 'raylı sistem girişini analiz ettim', en: 'rail entries analysed' } },
      { value: { tr: '1 yıl', en: '1 year' }, label: { tr: 'kulüpte sponsorluk koordinatörlüğü', en: 'as club sponsorship coordinator' } },
      { value: '2', label: { tr: 'TEKNOFEST takımı', en: 'TEKNOFEST teams' } },
      { value: { tr: '1 dönem', en: '1 term' }, label: { tr: 'Erasmus+ · Gdańsk', en: 'Erasmus+ · Gdańsk' } },
    ],
  },

  projects: [
    {
      id: 'pixel-oda',
      icon: 'home',
      date: '2026-10-03',
      title: { tr: 'Pixel Oda (bu site)', en: 'Pixel Room (this site)' },
      summary: {
        tr: 'Şu an gezdiğin oyunlaştırılmış portfolyo: odamda dolaşıp eşyalarla etkileşerek projelerime, deneyimime ve bana ulaşabiliyorsun. Acelesi olanlar için aynı içerik klasik görünümde.',
        en: 'The gamified portfolio you are exploring: walk around my room and interact with objects to reach my projects, experience and contact details. The same content lives in the classic view for anyone in a hurry.',
      },
      tags: ['JavaScript', 'Phaser 3', 'Vite', 'WebAudio'],
      cover: './assets/room/room.webp',
      links: {},
    },
    {
      id: 'ders-asistani',
      icon: 'book',
      date: '2026-10-02',
      title: { tr: 'Ders Asistanı', en: 'Study Assistant' },
      summary: {
        tr: 'Ders notlarını (PDF, fotoğraf, metin) yükleyince konu anlatımı çıkaran, soru soran, konu sonu testi ve bilgi kartları hazırlayan Android uygulaması. Günlük tekrar testleri, yanlışlar defteri, sınav geri sayımı ve çalışma serisi var. Sunucusu yok; tüm veri telefonda duruyor.',
        en: 'An Android app that turns your lecture notes (PDF, photo, text) into explanations, questions, end-of-topic tests and flashcards. It has daily review tests, a mistake log, an exam countdown and study streaks. There is no server; all data stays on the phone.',
      },
      tags: ['React Native', 'Expo', 'TypeScript', 'SQLite'],
      cover: './assets/projects/ders-asistani.webp',
      gallery: [
        { src: './assets/projects/ders-asistani/kapak.webp', caption: { tr: 'Uygulamanın genel görünümü', en: 'Overview of the app' } },
        { src: './assets/projects/ders-asistani/akis.webp', caption: { tr: 'Nottan sınava tek akış: günlük plan, slayt anlatım, mini sorular, test ve sonuç', en: 'One flow from notes to exam: daily plan, slide lessons, mini questions, test and result' } },
        { src: './assets/projects/ders-asistani/tekrar.webp', caption: { tr: 'Tekrar: yanlışlar, bilgi kartları, istatistik ve dersler', en: 'Review: mistakes, flashcards, statistics and courses' } },
        { src: './assets/projects/ders-asistani/tema.webp', caption: { tr: 'Açık ve koyu tema', en: 'Light and dark theme' } },
      ],
      links: {},
    },
    {
      id: 'rayli-sistemler',
      icon: 'train',
      date: '2026-09-26',
      title: { tr: 'İstanbul Raylı Sistemler 2025 Analizi', en: 'Istanbul Rail Systems 2025 Analysis' },
      summary: {
        tr: 'İBB açık verisiyle metro, tramvay, füniküler, teleferik ve Marmaray hatlarının 2025 kullanımını inceledim: hangi hatlar daha yoğun, kullanım yıl içinde nasıl değişiyor, olağan dışı günler hangileri ve hatların yolcu profilleri nasıl ayrışıyor.',
        en: 'Using Istanbul Municipality open data I studied how metro, tram, funicular, cable car and Marmaray lines were used in 2025: which lines are busiest, how use changes over the year, which days are unusual and how passenger profiles differ by line.',
      },
      findings: [
        { tr: 'İlk altı hat yolcunun %73’ünü taşıyor.', en: 'The top six lines carry 73% of riders.' },
        { tr: 'Sefer başına yolcuda M5 birinci: 809 yolcu.', en: 'M5 leads on riders per trip: 809.' },
        { tr: 'Medyan ve MAD’e dayalı yöntem, bilinen 18 olağan dışı günün 12’sini yakaladı.', en: 'A median/MAD-based method caught 12 of 18 known unusual days.' },
        { tr: '60 yaş üstü yolcu oranı ile hafta sonu kullanımı arasında ρ = 0,62.', en: 'ρ = 0.62 between the share of riders aged 60+ and weekend use.' },
      ],
      tags: ['Python', 'pandas', 'Jupyter', { tr: 'Veri görselleştirme', en: 'Data visualisation' }],
      stats: [
        { value: { tr: '1,06 milyar', en: '1.06 billion' }, label: { tr: 'giriş', en: 'entries' } },
        { value: '23', label: { tr: 'hat', en: 'lines' } },
        { value: '293', label: { tr: 'istasyon', en: 'stations' } },
        { value: { tr: '678.010', en: '678,010' }, label: { tr: 'satır veri', en: 'rows of data' } },
      ],
      cover: './assets/projects/rayli/hat_bazli_yolcu.webp',
      gallery: [
        { src: './assets/projects/rayli/hat_bazli_yolcu.webp', caption: { tr: 'Hat bazında yıllık yolcu', en: 'Annual riders by line' } },
        { src: './assets/projects/rayli/sefer_basina_yolcu.webp', caption: { tr: 'Sefer başına yolcu', en: 'Riders per trip' } },
        { src: './assets/projects/rayli/anomali_gunluk.webp', caption: { tr: 'Olağan dışı günler', en: 'Unusual days' } },
        { src: './assets/projects/rayli/kampus_gezi_hatlari.webp', caption: { tr: 'Kampüs hatları ve gezi hattı', en: 'Campus lines and the leisure line' } },
        { src: './assets/projects/rayli/en_yogun_istasyonlar.webp', caption: { tr: 'En yoğun 10 istasyon', en: 'Ten busiest stations' } },
      ],
      links: {
        source: 'https://github.com/IsmailSamiB/istanbul-rayli-sistemler',
        extra: [
          {
            label: { tr: 'Etkileşimli harita', en: 'Interactive map' },
            url: 'https://ismailsamib.github.io/istanbul-rayli-sistemler/harita/istasyon_kullanim_haritasi.html',
            note: { tr: 'Harita yapay zekâ desteğiyle hazırlandı.', en: 'The map was built with AI assistance.' },
          },
          {
            label: { tr: 'Kod Hattı öğreticisi', en: 'Kod Hattı tutorial' },
            url: 'https://ismailsamib.github.io/istanbul-rayli-sistemler/ogretici/',
          },
        ],
      },
    },
    {
      id: 'rota',
      icon: 'calendar',
      date: '2026-09-09',
      title: { tr: 'Rota — Alışkanlık Takibi', en: 'Rota — Habit Tracker' },
      summary: {
        tr: 'Günlük ve haftalık alışkanlıkları takip eden Android uygulaması. Hedef belirli günlere ya da “haftada X kez” biçiminde kurulabiliyor; günde birden çok tekrar, seri takibi ve başarımlar var. Aylık ısı haritası, gün detayı ve analiz ekranları neyin işe yaradığını gösteriyor; haftalık değerlendirme ve alışkanlık önerileri Gemini ile geliyor. Hatırlatıcılar, ana ekran widget’ı ve veriyi dışa aktarıp geri yükleme de var.',
        en: 'An Android app for tracking daily and weekly habits. A goal can be set for specific days or as “X times a week”, with several repetitions a day, streaks and achievements. A monthly heatmap, day detail and analytics screens show what is working; a weekly review and habit suggestions come from Gemini. It also has reminders, a home-screen widget and data export and restore.',
      },
      tags: ['Android', 'Kotlin', 'Jetpack Compose', 'Material 3', 'Room', 'Glance Widget', 'Gemini API'],
      cover: './assets/projects/rota.webp',
      // portrait: true -> dikey telefon ekranı (galeri dikey kutu ve yüksekliğe sığan büyütme kullanır)
      gallery: [
        { src: './assets/projects/rota/kapak.webp', caption: { tr: 'Uygulamanın genel görünümü', en: 'Overview of the app' } },
        { src: './assets/projects/rota/takip.webp', caption: { tr: 'Günlük takipten kalıcı alışkanlığa: bugün ekranı, esnek hedefler, ısı haritası, gün detayı', en: 'From daily tracking to lasting habits: today screen, flexible goals, heatmap, day detail' } },
        { src: './assets/projects/rota/icgoru.webp', caption: { tr: 'Veriden içgörüye: koç, zaman çizelgesi, haftalık kıyas, alışkanlık detayı', en: 'From data to insight: coach, timeline, weekly comparison, habit detail' } },
      ],
      links: {},
    },
    {
      id: 'deptron',
      icon: 'trophy',
      date: '2025-09-01',
      title: { tr: 'Deptron — TEKNOFEST', en: 'Deptron — TEKNOFEST' },
      summary: {
        tr: 'Deptron, Yıldız Teknik Üniversitesi’nde otonom depo robotu geliştiren takım. Kuruluşunda yer aldım; ilk senemizde TEKNOFEST finalinde derece elde ettik.',
        en: 'Deptron is a team at Yıldız Technical University building an autonomous warehouse robot. I helped found it; we placed in the TEKNOFEST finals in our first year.',
      },
      tags: ['TEKNOFEST', { tr: 'Organizasyon', en: 'Organising' }, { tr: 'Takım', en: 'Team' }, { tr: 'Otonom robot', en: 'Autonomous robot' }],
      cover: './assets/projects/deptron.webp',
      coverCenter: true,
      links: {},
    },
    {
      id: 'iha',
      icon: 'drone',
      date: '2023-08-01',
      title: { tr: 'İHA Takımı', en: 'UAV Team' },
      summary: {
        tr: "Lisede sınıf arkadaşlarımla kurduğumuz İHA takımıyla TEKNOFEST’e katılma hakkı kazandık. Takımın sertifikalı İHA pilotuydum; elektrik işlerinden de sorumluydum.",
        en: "In high school my classmates and I founded a UAV team and qualified to compete at TEKNOFEST. I was the team’s certified UAV pilot and also handled its electrical work.",
      },
      tags: [{ tr: 'İHA', en: 'UAV' }, 'TEKNOFEST', { tr: 'Sponsorluk', en: 'Sponsorship' }],
      cover: './assets/projects/iha.webp',
      coverCenter: true,
      links: {},
    },
  ],

  skills: [
    {
      group: { tr: 'Veri ve analiz', en: 'Data & analysis' },
      items: [
        { name: 'Python', level: 3 },
        { name: 'Microsoft Excel', level: 4 },
        { name: 'R', level: 1 },
        { name: 'SQL', level: 1 },
        { name: 'SPSS', level: 1 },
      ],
    },
    {
      group: { tr: 'Araçlar', en: 'Tools' },
      items: [
        { name: 'Microsoft Office (Word, PowerPoint)', level: 4 },
        { name: { tr: 'Entegra (e-ticaret)', en: 'Entegra (e-commerce)' }, level: 3 },
      ],
    },
    {
      group: { tr: 'Çalışma biçimi', en: 'Ways of working' },
      items: [
        { name: { tr: 'Takım çalışması', en: 'Teamwork' }, level: 5 },
        { name: { tr: 'Organizasyon yönetimi', en: 'Organising & coordination' }, level: 4 },
        { name: { tr: 'İletişim', en: 'Communication' }, level: 4 },
      ],
    },
    {
      group: { tr: 'Diller', en: 'Languages' },
      kind: 'languages',
      items: [
        { name: { tr: 'Türkçe (ana dil)', en: 'Turkish (native)' }, level: 5 },
        { name: { tr: 'İngilizce (B2)', en: 'English (B2)' }, level: 4 },
        { name: { tr: 'İspanyolca (A1)', en: 'Spanish (A1)' }, level: 1 },
      ],
    },
  ],

  // İş ve staj (yeniden eskiye)
  // Bir kayıt isteğe bağlı roles[] taşıyabilir (aynı kurumda birden çok görev; title = kurum adı, roles yeniden eskiye).
  experience: [
    {
      period: { tr: 'Ağu 2026 – Eyl 2026', en: 'Aug 2026 – Sep 2026' },
      title: { tr: 'Veri Analizi Stajyeri', en: 'Data Analysis Intern' },
      org: { tr: 'SGK Bursa İl Müdürlüğü', en: 'SGK Bursa Provincial Directorate' },
      note: {
        tr: 'Veri toplama, düzenleme, analiz ve görselleştirme; veri aktarımı ve küçük çaplı otomasyon. Ağırlıklı olarak Excel ve Python, temel düzeyde R ve SQL.',
        en: 'Data collection, cleaning, analysis and visualisation; data transfer and small automation tasks. Mostly Excel and Python, with R and SQL at a basic level.',
      },
    },
    {
      period: { tr: 'Tem 2025 – Eyl 2025', en: 'Jul 2025 – Sep 2025' },
      title: { tr: 'E-Ticaret Operasyon Destek', en: 'E-commerce Operations Support' },
      org: 'Tobacium',
      note: {
        tr: 'Çeşitli e-ticaret platformlarında satış operasyonlarına destek; Excel ve Office araçlarıyla operasyon takibi.',
        en: 'Supported sales operations on several e-commerce platforms; tracked operations with Excel and Office tools.',
      },
    },
    {
      period: { tr: '2023 – 2025 · yarı zamanlı', en: '2023 – 2025 · part-time' },
      title: { tr: 'Etkinlik ve Operasyon Destek', en: 'Event & Operations Support' },
      org: { tr: 'Çeşitli işletmeler', en: 'Various venues' },
      note: {
        tr: 'Garsonluk, runnerlık, bulaşıkçılık, bilet okuma. Yoğun tempoya uyum ve insan ilişkileri konusunda çok şey öğretti.',
        en: 'Waiting tables, working as a runner, dishwashing, ticket scanning. Taught me a lot about working under pressure and with people.',
      },
    },
  ],

  // Kulüp, takım ve gönüllülük (CV’deki "Aktiviteler ve Projeler")
  activities: [
    {
      period: { tr: 'Eki 2024 – devam', en: 'Oct 2024 – present' },
      title: { tr: 'MİNT Kulübü', en: 'MİNT Club' },
      org: { tr: 'Öğrenci kulübü · 4 görev', en: 'Student club · 4 roles' },
      roles: [
        {
          period: { tr: 'Haz 2026 – devam', en: 'Jun 2026 – present' },
          title: { tr: 'Ekip Üyesi', en: 'Team Member' },
        },
        {
          period: { tr: 'Haz 2025 – Haz 2026', en: 'Jun 2025 – Jun 2026' },
          title: { tr: 'Sponsorluk Koordinatörü · Yönetim Kurulu Üyesi', en: 'Sponsorship Coordinator · Executive Board Member' },
          note: {
            tr: 'Farklı sektörlerden firmalarla sponsorluk toplantıları ve iş birlikleri.',
            en: 'Sponsorship meetings and partnerships with companies from several sectors.',
          },
        },
        {
          period: { tr: 'Mar 2025 – Haz 2025', en: 'Mar 2025 – Jun 2025' },
          title: { tr: 'Sponsorluk Koordinatör Yardımcısı', en: 'Assistant Sponsorship Coordinator' },
        },
        {
          period: { tr: 'Eki 2024 – Mar 2025', en: 'Oct 2024 – Mar 2025' },
          title: { tr: 'Sponsorluk Birimi', en: 'Sponsorship Team Member' },
        },
      ],
    },
    {
      period: { tr: 'Mar 2025 – Eyl 2025', en: 'Mar 2025 – Sep 2025' },
      title: { tr: 'Organizasyon Ekip Üyesi', en: 'Organising Team Member' },
      org: 'Deptron',
      logo: './assets/logos/deptron.png',
      note: {
        tr: 'Otonom depo robotu geliştiren takım. Takımın kuruluşunda yer aldım; ilk senemizde TEKNOFEST finalinde derece elde ettik.',
        en: 'A team building an autonomous warehouse robot. Helped found the team; we placed in the TEKNOFEST finals in our first year.',
      },
    },
    {
      period: { tr: 'Eyl 2022 – Ağu 2023', en: 'Sep 2022 – Aug 2023' },
      title: { tr: 'Takım Üyesi & Sertifikalı İHA Pilotu', en: 'Team Member & Certified UAV Pilot' },
      org: { tr: 'AITT · Şükrü Şankaya Anadolu Lisesi', en: 'AITT · Şükrü Şankaya Anatolian High School' },
      logo: './assets/logos/aitt.png',
      note: {
        tr: 'Sınıf arkadaşlarımla kurduğumuz takımla TEKNOFEST’e katılma hakkı kazandık. Takımda elektrik işlerinden de sorumluydum.',
        en: 'Qualified for TEKNOFEST with a team founded with classmates. I also handled its electrical work.',
      },
    },
    {
      period: { tr: 'Eki 2019 – Ara 2021', en: 'Oct 2019 – Dec 2021' },
      title: { tr: 'Gönüllü', en: 'Volunteer' },
      org: 'SosyalBen',
      note: {
        tr: 'Bir yıllık gönüllülük eğitiminin ardından 8-10 yaş grubuna yönelik saha faaliyetleri.',
        en: 'Field activities for children aged 8–10 after a year of volunteer training.',
      },
    },
  ],

  education: [
    {
      period: { tr: 'Eki 2023 – devam', en: 'Oct 2023 – present' },
      title: { tr: 'İstatistik, Lisans', en: 'BSc in Statistics' },
      org: { tr: 'Yıldız Teknik Üniversitesi', en: 'Yıldız Technical University' },
      logo: './assets/logos/ytu.png',
      note: {
        tr: 'İstatistik lisans öğrencisi.',
        en: 'Undergraduate student in Statistics.',
      },
    },
    {
      period: { tr: '2026 Bahar', en: 'Spring 2026' },
      title: { tr: 'Erasmus+ · Management', en: 'Erasmus+ · Management' },
      org: { tr: 'Gdańsk Teknik Üniversitesi', en: 'Gdańsk University of Technology' },
      logo: './assets/logos/gdansk.png',
      note: {
        tr: 'Farklı kültürlerle çalışma ve iletişim becerilerimi geliştirdiğim bir dönem.',
        en: 'A term in which I improved at working and communicating across cultures.',
      },
    },
  ],

  certificates: [
    { tr: 'Entegra Kullanım Sertifikası', en: 'Entegra User Certificate' },
    { tr: 'Garanti BBVA Genç Yeni Nesil Kariyer Okulu – Teknoloji Serisi', en: 'Garanti BBVA Young New Generation Career School – Technology Series' },
    { tr: 'İHA Pilotu Sertifikası', en: 'UAV Pilot Certificate' },
  ],

  contact: {
    email: 'basaraner1629@gmail.com',
    links: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/ismail-sami-ba%C5%9Faraner-a7b616173' },
      { label: 'GitHub', url: 'https://github.com/IsmailSamiB' },
    ],
    note: {
      tr: 'Staj, yarı zamanlı iş ve iş birliği fırsatlarına açığım. E-postayla ulaşabilirsin.',
      en: 'I am open to internships, part-time roles and collaborations. Email is the best way to reach me.',
    },
  },

  hometown: {
    title: { tr: 'Memleketim Bursa', en: 'My hometown, Bursa' },
    text: {
      tr: "Uludağ’ın eteklerinde, yeşiliyle ünlü şehir. Buradan bakınca aklım hep orada.",
      en: 'The green city at the foot of Mount Uludağ. Looking out from here, my mind is always there.',
    },
  },

  erasmus: {
    title: { tr: 'Gdańsk’tan sevgiler', en: 'Greetings from Gdańsk' },
    text: {
      tr: '2026 baharını Erasmus+ ile Gdańsk Teknik Üniversitesi’nde geçirdim. Farklı insanları ve farklı kültürleri ilk elden tanıma fırsatı buldum. Hiç tanımadığım bir ülkede dört ay boyunca bir düzen kurmaya çalışmak benim için özel bir deneyimdi.',
      en: 'I spent spring 2026 at Gdańsk University of Technology through Erasmus+. I got to know different people and cultures first-hand. Trying to build a routine for four months in a country I had never been to was a special experience for me.',
    },
  },
};

