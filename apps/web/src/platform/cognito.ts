import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';

const poolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;

function getPool(): CognitoUserPool {
  if (!poolId || !clientId) {
    throw new Error('Missing VITE_COGNITO_USER_POOL_ID or VITE_COGNITO_CLIENT_ID environment variable');
  }
  return new CognitoUserPool({
    UserPoolId: poolId,
    ClientId: clientId,
  });
}

export interface SignedInSession {
  readonly session: CognitoUserSession;
  readonly idToken: string;
  readonly username: string;
}

let current: SignedInSession | null = null;

export async function signIn(email: string, password: string): Promise<SignedInSession> {
  const pool = getPool();
  const user = new CognitoUser({ Username: email, Pool: pool });
  const details = new AuthenticationDetails({ Username: email, Password: password });
  const session = await new Promise<CognitoUserSession>((resolve, reject) => {
    user.authenticateUser(details, { onSuccess: resolve, onFailure: reject });
  });
  const signed: SignedInSession = {
    session,
    idToken: session.getIdToken().getJwtToken(),
    username: email,
  };
  current = signed;
  return signed;
}

export async function getIdToken(): Promise<string> {
  if (current && current.session.isValid()) return current.idToken;
  const pool = getPool();
  const user = pool.getCurrentUser();
  if (!user) throw new Error('not signed in');
  const session = await new Promise<CognitoUserSession>((resolve, reject) => {
    user.getSession((err: Error | null, s: CognitoUserSession | null) => {
      if (err || !s) reject(err ?? new Error('no session'));
      else resolve(s);
    });
  });
  const token = session.getIdToken().getJwtToken();
  current = { session, idToken: token, username: user.getUsername() };
  return token;
}

export function signOut(): void {
  try {
    getPool().getCurrentUser()?.signOut();
  } catch {
    // ignore if unconfigured
  }
  current = null;
}
