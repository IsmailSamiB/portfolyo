// Firebase yapılandırması.
// Değerler Firebase konsolundan (Proje ayarları > Genel > Uygulamalarınız > Web uygulaması) kopyalanıp
// buraya yapıştırılır. Bu değerler GİZLİ DEĞİLDİR; tarayıcıya zaten açık gider. Güvenliği
// firestore.rules dosyasındaki kurallar sağlar.
// Alanlar boşken site "yerel modda" çalışır: hiçbir ağ isteği yapılmaz, ziyaretçi defteri kapalıdır.
// Adım adım kurulum: docs/firebase-kurulum.md

export const firebaseConfig = {
  apiKey: 'AIzaSyCS8_p9G57XiRUJJPchJDGPVAk1c4w7nog',
  authDomain: 'portfoy-65fb9.firebaseapp.com',
  projectId: 'portfoy-65fb9',
  appId: '1:704454579897:web:9628198ee676e69e59ad68',
};

// Yönetici paneline (…/?admin) girebilecek tek Google hesabı.
// Değiştirirsen firestore.rules içindeki adresi de değiştir.
export const ADMIN_EMAIL = 'basaraner1629@gmail.com';
