import { Environment } from './environment.types';

export type { Environment, FirebaseConfig, AppCheckConfig } from './environment.types';

export const environment: Environment = {
  production: false,
  environmentName: 'development',
  useEmulators: false,
  firebase: {
    apiKey: 'DEV_FIREBASE_API_KEY',
    authDomain: 'nacs-platform-staging.firebaseapp.com',
    projectId: 'nacs-platform-staging',
    storageBucket: 'nacs-platform-staging.firebasestorage.app',
    messagingSenderId: 'DEV_MESSAGING_SENDER_ID',
    appId: '1:DEV:web:DEV_APP_ID',
  },
  appCheck: {
    siteKey: 'DEV_RECAPTCHA_ENTERPRISE_KEY',
    isTokenAutoRefreshEnabled: true,
    debugToken: 'DEV_APPCHECK_DEBUG_TOKEN',
  },
};
