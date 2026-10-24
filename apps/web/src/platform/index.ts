import { PlatformApi } from './sdk.ts';
import { getIdToken as getCognitoToken, signOut as cognitoSignOut } from './cognito.ts';
import { getDevIdentityToken } from './dev-identity.ts';
import { createGeneratedClients } from './generated/index.ts';

async function resolveToken(): Promise<string> {
  const dev = getDevIdentityToken();
  if (dev) return dev;
  return getCognitoToken();
}

const baseUrl = (import.meta.env.VITE_PLATFORM_API_URL as string) || 'http://localhost:4000';

export const platform = new PlatformApi({
  baseUrl,
  getIdToken: resolveToken,
});

export const generated = createGeneratedClients(platform);

export function signOut(): void {
  cognitoSignOut();
}
