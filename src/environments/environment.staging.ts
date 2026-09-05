import { Environment } from './environment.types';

export const environment: Environment = {
  production: false,
  environmentName: 'staging',
  useEmulators: false,
  firebase: {
    apiKey: 'STAGING_FIREBASE_API_KEY',
    authDomain: 'nacs-platform-staging.firebaseapp.com',
    projectId: 'nacs-platform-staging',
    storageBucket: 'nacs-platform-staging.firebasestorage.app',
    messagingSenderId: 'STAGING_MESSAGING_SENDER_ID',
    appId: '1:STAGING:web:STAGING_APP_ID',
  },
  appCheck: {
    siteKey: 'STAGING_RECAPTCHA_ENTERPRISE_KEY',
    isTokenAutoRefreshEnabled: true,
    debugToken: 'STAGING_APPCHECK_DEBUG_TOKEN',
  },
};
