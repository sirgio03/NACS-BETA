import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { initializeApp, provideFirebaseApp, getApp } from '@angular/fire/app';
import { getAuth, provideAuth, connectAuthEmulator } from '@angular/fire/auth';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getStorage, provideStorage, connectStorageEmulator } from '@angular/fire/storage';
import { getFunctions, provideFunctions, connectFunctionsEmulator } from '@angular/fire/functions';
import {
  provideAppCheck,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  CustomProvider,
} from '@angular/fire/app-check';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),

    // Firebase App Initialization
    provideFirebaseApp(() => initializeApp(environment.firebase)),

    // Firebase Authentication
    provideAuth(() => {
      const auth = getAuth();
      if (environment.useEmulators) {
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      }
      return auth;
    }),

    // Cloud Firestore
    provideFirestore(() => {
      const firestore = getFirestore();
      if (environment.useEmulators) {
        connectFirestoreEmulator(firestore, 'localhost', 8080);
      }
      return firestore;
    }),

    // Firebase Storage
    provideStorage(() => {
      const storage = getStorage();
      if (environment.useEmulators) {
        connectStorageEmulator(storage, 'localhost', 9199);
      }
      return storage;
    }),

    // Cloud Functions
    provideFunctions(() => {
      const functions = getFunctions();
      if (environment.useEmulators) {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      return functions;
    }),

    // Firebase App Check with strict environment separation
    provideAppCheck(() => {
      const app = getApp();

      // Configure debug token strictly in non-production environments
      if (!environment.production && typeof window !== 'undefined') {
        if (environment.appCheck.debugToken) {
          (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = environment.appCheck.debugToken;
        } else if (isDevMode()) {
          (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
      }

      // In production, debug token is completely omitted; real reCAPTCHA Enterprise provider is enforced
      const provider = new ReCaptchaEnterpriseProvider(environment.appCheck.siteKey);

      return initializeAppCheck(app, {
        provider,
        isTokenAutoRefreshEnabled: environment.appCheck.isTokenAutoRefreshEnabled,
      });
    }),
  ],
};
