// Firebase Authentication. Yalnızca yönetici fonksiyonları için, store.js içinden import() ile yüklenir.
// Oturum yalnızca sekme/tarayıcı açıkken geçerli (browserSessionPersistence): kapanınca yönetici oturumu biter.
import {
  initializeAuth,
  browserSessionPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { app } from './firebase.js';

export const auth = initializeAuth(app, {
  persistence: browserSessionPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

export { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged };
