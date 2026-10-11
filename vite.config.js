import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
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

// Phaser kaynak kodu derleme zamanı bayrakları bekler (`typeof WEBGL_RENDERER` gibi); webpack'teki
// DefinePlugin'in yaptığını burada yaparız. Kapalı bayrakların arkasındaki require'lar pakete girmez.
const PHASER_FLAGS = {
  WEBGL_RENDERER: true,
  CANVAS_RENDERER: true,
  WEBGL_DEBUG: false,
  FEATURE_SOUND: false, // ses sitenin kendi WebAudio kodunda (src/audio.js)
  PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false,
};
const PHASER_SRC = /[\\/]node_modules[\\/]phaser[\\/]src[\\/].*\.js$/;
const PHASER_FLAG_RE = new RegExp(`typeof (${Object.keys(PHASER_FLAGS).join('|')})\\b`, 'g');
const setPhaserFlags = (code) => code.replace(PHASER_FLAG_RE, (_, name) => String(PHASER_FLAGS[name]));

const phaserFlags = {
  name: 'phaser-flags',
  enforce: 'pre',
  // Geliştirme sunucusu: bağımlılık ön paketlemesi (esbuild) sırasında uygula
  config: () => ({
    optimizeDeps: {
      esbuildOptions: {
        plugins: [
          {
            name: 'phaser-flags',
            setup(build) {
              build.onLoad({ filter: PHASER_SRC }, async ({ path }) => ({ contents: setPhaserFlags(await readFile(path, 'utf8')), loader: 'js' }));
            },
          },
        ],
      },
    },
  }),
  // Derleme: CommonJS dönüşümünden önce uygula
  transform(code, id) {
    if (!PHASER_SRC.test(id.split('?')[0]) || !code.includes('typeof ')) return null;
    return { code: setPhaserFlags(code), map: null };
  },
};

export default defineConfig({
  // Göreli yollar: GitHub Pages gibi alt klasörde yayınlanınca da çalışır
  base: './',
  plugins: [securityMeta, phaserFlags],
  // 'phaser' içe aktarımları yalnızca kullanılan modülleri toplayan özel girişe gider (src/phaser-custom.js)
  resolve: { alias: [{ find: /^phaser$/, replacement: fileURLToPath(new URL('./src/phaser-custom.js', import.meta.url)) }] },
  // assets-src: ham görseller; izlenmesine gerek yok (kilitli dosyada izleyici çöküyordu)
  server: { port: 5173, watch: { ignored: ['**/assets-src/**'] } },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    // Phaser (özel girişle ~655 kB; tamamı ~1,2 MB) kendi parçasında durur (sürüm değişmedikçe önbellekte kalır)
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
