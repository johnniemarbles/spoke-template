export interface PlatformApiOptions {
  readonly baseUrl: string;
  readonly getIdToken: () => Promise<string>;
}

export interface Me {
  readonly person: { id: string };
  readonly tenant: { id: string; country: string; region: string };
  readonly app: string;
  readonly permissions: readonly string[];
  readonly hierarchyScope: string;
}

export class PlatformApiError extends Error {
  readonly code: string;
  readonly traceId: string;

  constructor(code: string, traceId: string, message?: string) {
    super(message ?? code);
    this.name = 'PlatformApiError';
    this.code = code;
    this.traceId = traceId;
  }
}

export class PlatformApi {
  private readonly options: PlatformApiOptions;

  constructor(options: PlatformApiOptions) {
    this.options = options;
  }

  async me(): Promise<Me> {
    return this.request<Me>('GET', '/v1/me');
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.options.getIdToken();
    const res = await fetch(`${this.options.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const json = (await res.json()) as {
      ok: boolean;
      traceId: string;
      code?: string;
      message?: string;
      result?: T;
    };

    if (!json.ok) {
      throw new PlatformApiError(json.code ?? 'REFUSED', json.traceId, json.message);
    }
    return json.result as T;
  }
}
