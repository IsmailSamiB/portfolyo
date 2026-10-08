import { defineConfig } from 'vite';
import { firebaseConfig } from './src/data/config.js';

// authDomain doluysa ve biçimi geçerliyse Google girişi penceresine izin ver; değilse kapalı.
const authDomain = String(firebaseConfig.authDomain || '');
const frameSrc = /^[a-z0-9.-]+$/.test(authDomain) && authDomain ? `https://${authDomain}` : "'none'";

const csp = [
  "default-src 'self'",
  "script-src 'self' https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "style-src-elem 'self'",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "media-src 'none'",
  "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
  `frame-src ${frameSrc}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

// CSP yalnızca derlemede eklenir (geliştirme sunucusunda HMR bozulmasın)
const securityMeta = {
  name: 'security-meta',
  apply: 'build',
  transformIndexHtml(html) {
    const tags =
      `\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />` +
      `\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`;
    return html.replace(/(<meta charset="UTF-8"\s*\/?>)/i, `$1${tags}`);
  },
};

export default defineConfig({
  // Göreli yollar: GitHub Pages gibi alt klasörde yayınlanınca da çalışır
  base: './',
  plugins: [securityMeta],
  // assets-src: ham görseller; izlenmesine gerek yok (kilitli dosyada izleyici çöküyordu)
  server: { port: 5173, watch: { ignored: ['**/assets-src/**'] } },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    // Phaser tek başına ~1,2 MB; kendi parçasında durur (sürüm değişmedikçe önbellekte kalır)
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        // phase.js gibi birkaç satırlık ortak modüller ayrı istek olmasın
        experimentalMinChunkSize: 1000,
        manualChunks(id) {
          if (id.includes('/node_modules/phaser/')) return 'phaser';
        },
      },
    },
  },
});
