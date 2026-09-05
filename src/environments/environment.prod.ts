import { Environment } from './environment.types';

export const environment: Environment = {
  production: true,
  environmentName: 'production',
  useEmulators: false,
  firebase: {
    apiKey: 'PROD_FIREBASE_API_KEY',
    authDomain: 'nacs-platform-prod.firebaseapp.com',
    projectId: 'nacs-platform-prod',
    storageBucket: 'nacs-platform-prod.firebasestorage.app',
    messagingSenderId: 'PROD_MESSAGING_SENDER_ID',
    appId: '1:PROD:web:PROD_APP_ID',
  },
  appCheck: {
    siteKey: 'PROD_RECAPTCHA_ENTERPRISE_KEY',
    isTokenAutoRefreshEnabled: true,
    // Debug token strictly omitted in production.
  },
};
