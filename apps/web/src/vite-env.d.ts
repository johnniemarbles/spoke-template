/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COGNITO_USER_POOL_ID?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_PLATFORM_API_URL?: string;
  readonly VITE_DEV_IDENTITY_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
