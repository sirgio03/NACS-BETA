export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface AppCheckConfig {
  siteKey: string;
  isTokenAutoRefreshEnabled: boolean;
  debugToken?: string;
}

export interface Environment {
  production: boolean;
  environmentName: 'development' | 'staging' | 'production';
  firebase: FirebaseConfig;
  appCheck: AppCheckConfig;
  useEmulators: boolean;
}
