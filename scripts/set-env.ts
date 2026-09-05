import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const targetEnv = process.env['NACS_ENV'] || 'staging';
const isProd = targetEnv === 'production';

console.log(`[set-env] Generating Angular environment files for target: ${targetEnv}`);

const stagingConfig = `import { Environment } from './environment';

export const environment: Environment = {
  production: false,
  environmentName: 'staging',
  useEmulators: ${process.env['NACS_USE_EMULATORS'] === 'true'},
  firebase: {
    apiKey: '${process.env['STAGING_FIREBASE_API_KEY'] || 'STAGING_FIREBASE_API_KEY'}',
    authDomain: '${process.env['STAGING_FIREBASE_AUTH_DOMAIN'] || 'nacs-platform-staging.firebaseapp.com'}',
    projectId: '${process.env['STAGING_FIREBASE_PROJECT_ID'] || 'nacs-platform-staging'}',
    storageBucket: '${process.env['STAGING_FIREBASE_STORAGE_BUCKET'] || 'nacs-platform-staging.firebasestorage.app'}',
    messagingSenderId: '${process.env['STAGING_FIREBASE_MESSAGING_SENDER_ID'] || 'STAGING_MESSAGING_SENDER_ID'}',
    appId: '${process.env['STAGING_FIREBASE_APP_ID'] || '1:STAGING:web:STAGING_APP_ID'}',
  },
  appCheck: {
    siteKey: '${process.env['STAGING_APP_CHECK_SITE_KEY'] || 'STAGING_RECAPTCHA_ENTERPRISE_KEY'}',
    isTokenAutoRefreshEnabled: true,
    debugToken: '${process.env['STAGING_APP_CHECK_DEBUG_TOKEN'] || 'STAGING_APPCHECK_DEBUG_TOKEN'}',
  },
};
`;

const prodConfig = `import { Environment } from './environment';

export const environment: Environment = {
  production: true,
  environmentName: 'production',
  useEmulators: false,
  firebase: {
    apiKey: '${process.env['PROD_FIREBASE_API_KEY'] || 'PROD_FIREBASE_API_KEY'}',
    authDomain: '${process.env['PROD_FIREBASE_AUTH_DOMAIN'] || 'nacs-platform-prod.firebaseapp.com'}',
    projectId: '${process.env['PROD_FIREBASE_PROJECT_ID'] || 'nacs-platform-prod'}',
    storageBucket: '${process.env['PROD_FIREBASE_STORAGE_BUCKET'] || 'nacs-platform-prod.firebasestorage.app'}',
    messagingSenderId: '${process.env['PROD_FIREBASE_MESSAGING_SENDER_ID'] || 'PROD_MESSAGING_SENDER_ID'}',
    appId: '${process.env['PROD_FIREBASE_APP_ID'] || '1:PROD:web:PROD_APP_ID'}',
  },
  appCheck: {
    siteKey: '${process.env['PROD_APP_CHECK_SITE_KEY'] || 'PROD_RECAPTCHA_ENTERPRISE_KEY'}',
    isTokenAutoRefreshEnabled: true,
    // Debug token strictly omitted in production.
  },
};
`;

const envDir = path.join(__dirname, '../src/environments');

if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

fs.writeFileSync(path.join(envDir, 'environment.staging.ts'), stagingConfig, { encoding: 'utf-8' });
fs.writeFileSync(path.join(envDir, 'environment.prod.ts'), prodConfig, { encoding: 'utf-8' });

console.log('[set-env] Successfully wrote environment.staging.ts and environment.prod.ts');
