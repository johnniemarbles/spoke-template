/**
 * Local development identity helper.
 * If VITE_DEV_IDENTITY_TOKEN is present in DEV mode, returns it without needing Cognito.
 */
export function getDevIdentityToken(): string | null {
  if (import.meta.env.DEV) {
    const devToken = import.meta.env.VITE_DEV_IDENTITY_TOKEN as string | undefined;
    if (devToken && devToken.trim()) {
      return devToken.trim();
    }
  }
  return null;
}
