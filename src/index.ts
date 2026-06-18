export type RuntimeState = "OPERATIONAL" | "MAINTENANCE" | "DEGRADED" | "OUTAGE";

export interface CapabilityState {
  capabilityName: string;
  state: RuntimeState;
  message: string;
}

export interface RuntimeResponse {
  applicationId: string;
  state: RuntimeState;
  message: string;
  capabilityStates: CapabilityState[];
  version: number;
  updatedAt: Date;
  dataStatus: "FRESH" | "STALE";
  lastSuccessfulFetchAt: Date;

  hasCapability(name: string): boolean;
  getCapabilityState(name: string): CapabilityState | undefined;
}

export interface RuntimeHQClientOptions {
  runtimeKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface WatchRuntimeOptions {
  intervalSeconds?: number;
  onUpdate: (runtime: RuntimeResponse) => void;
  onError?: (error: Error) => void;
}

export class RuntimeHQError extends Error {
  public status: number;
  public statusText: string;

  constructor(message: string, status: number, statusText: string) {
    super(message);
    this.name = 'RuntimeHQError';
    this.status = status;
    this.statusText = statusText;

    // Set prototype explicitly to maintain correct inheritance in transpiled code
    Object.setPrototypeOf(this, RuntimeHQError.prototype);
  }
}

interface ApiCapabilityState {
  capabilityName: string;
  state: string;
  message: string;
}

interface ApiPayload {
  applicationId: string;
  state: string;
  message: string;
  capabilityStates?: ApiCapabilityState[];
  version?: number | string;
  updatedAt: string;
}

interface ApiWrapper {
  runtimeState?: ApiPayload;
}

export class RuntimeHQClient {
  private runtimeKey: string;
  private baseUrl: string;
  private customFetch?: typeof fetch;
  private lastResponse: RuntimeResponse | null = null;

  constructor(options: RuntimeHQClientOptions) {
    if (!options) {
      throw new Error('Options object is required');
    }
    if (typeof options.runtimeKey !== 'string') {
      throw new Error('runtimeKey is required and must be a string');
    }

    const key = options.runtimeKey.trim();
    if (!key.startsWith('rt_prod_') && !key.startsWith('rt_test_')) {
      throw new Error('runtimeKey must start with rt_prod_ or rt_test_');
    }

    this.runtimeKey = key;
    this.baseUrl = (options.baseUrl || 'https://edge.theruntimehq.com').replace(/\/+$/, '');
    this.customFetch = options.fetch;
  }

  private getFetchFn(): typeof fetch {
    if (this.customFetch) {
      return this.customFetch;
    }
    if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
      return globalThis.fetch;
    }
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      return window.fetch;
    }
    throw new Error('A global fetch implementation is not available. Please pass a custom fetch implementation in options.');
  }

  private mapState(apiState: string): RuntimeState {
    const normalized = apiState.replace(/^RUNTIME_STATE_/, '');
    const validStates: RuntimeState[] = ["OPERATIONAL", "MAINTENANCE", "DEGRADED", "OUTAGE"];
    if (validStates.includes(normalized as RuntimeState)) {
      return normalized as RuntimeState;
    }
    throw new Error(`Unknown runtime state: ${apiState}`);
  }

  /**
   * Fetches the current runtime status.
   */
  async getRuntime(): Promise<RuntimeResponse> {
    const fetchFn = this.getFetchFn();
    const url = `${this.baseUrl}/v1/${this.runtimeKey}.json`;

    let response: Response;
    try {
      response = await fetchFn(url);
    } catch (err) {
      const networkError = err instanceof Error ? err : new Error(String(err));
      throw new Error(`Network request failed: ${networkError.message}`);
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const body = await response.json();
        if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
          errorMessage = body.message;
        }
      } catch {
        // Fallback to default message on non-JSON or unparseable body
      }
      throw new RuntimeHQError(errorMessage, response.status, response.statusText);
    }

    let rawBody: ApiWrapper;
    try {
      rawBody = await response.json() as ApiWrapper;
    } catch (err) {
      throw new Error(`Failed to parse JSON response: ${(err as Error).message}`);
    }

    if (!rawBody || typeof rawBody !== 'object') {
      throw new Error('Invalid response body: payload is not an object');
    }

    // Handle grpc-gateway wrapper or direct payload
    const payload: ApiPayload = rawBody.runtimeState || (rawBody as unknown as ApiPayload);

    const lastFetchDate = new Date();

    const capabilityStates: CapabilityState[] = (payload.capabilityStates || []).map(c => ({
      capabilityName: c.capabilityName || '',
      state: this.mapState(c.state || ''),
      message: c.message || '',
    }));

    const runtimeResponse: RuntimeResponse = {
      applicationId: payload.applicationId || '',
      state: this.mapState(payload.state || ''),
      message: payload.message || '',
      capabilityStates,
      version: payload.version ? parseInt(payload.version.toString(), 10) : 0,
      updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : lastFetchDate,
      dataStatus: "FRESH",
      lastSuccessfulFetchAt: lastFetchDate,
      hasCapability(name: string): boolean {
        return this.capabilityStates.some(c => c.capabilityName === name);
      },
      getCapabilityState(name: string): CapabilityState | undefined {
        return this.capabilityStates.find(c => c.capabilityName === name);
      }
    };

    // Cache the last successful response
    this.lastResponse = runtimeResponse;
    return runtimeResponse;
  }

  /**
   * Subscribes to runtime updates.
   * Periodically polls the server and invokes the callbacks.
   */
  watchRuntime(options: WatchRuntimeOptions): () => void {
    if (!options || typeof options.onUpdate !== 'function') {
      throw new Error('options.onUpdate is required and must be a function');
    }

    const intervalSeconds = typeof options.intervalSeconds === 'number' && options.intervalSeconds > 0
      ? options.intervalSeconds
      : 60;

    let isPolling = true;
    let timerId: any = null;
    let lastEmittedStatus: "FRESH" | "STALE" | null = null;

    const poll = async () => {
      if (!isPolling) return;

      try {
        const res = await this.getRuntime();
        if (isPolling) {
          lastEmittedStatus = "FRESH";
          options.onUpdate(res);
        }
      } catch (err) {
        if (!isPolling) return;

        const error = err instanceof Error ? err : new Error(String(err));
        if (options.onError) {
          try {
            options.onError(error);
          } catch {
            // Suppress callback error to prevent crashing the polling loop
          }
        }

        // If we have a previous successful response, emit it as STALE (only once upon transition)
        if (this.lastResponse && isPolling && lastEmittedStatus !== "STALE") {
          const staleResponse: RuntimeResponse = {
            ...this.lastResponse,
            dataStatus: "STALE",
          };
          lastEmittedStatus = "STALE";
          options.onUpdate(staleResponse);
        }
      } finally {
        if (isPolling) {
          timerId = setTimeout(poll, intervalSeconds * 1000);
        }
      }
    };

    // Trigger initial poll immediately
    poll();

    // Return unsubscribe function
    return () => {
      isPolling = false;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    };
  }

  /**
   * Retrieves the last successful response cached on this client instance (if any).
   */
  getLastCachedResponse(): RuntimeResponse | null {
    return this.lastResponse;
  }
}
