export type RuntimeState = "OPERATIONAL" | "MAINTENANCE" | "DEGRADED" | "OUTAGE";

export type RuntimeSourceType = "OPERATIONAL" | "INCIDENT" | "MAINTENANCE" | "SIMULATION";

export interface RuntimeResponse {
  applicationId: string;
  state: RuntimeState;
  message: string;
  sourceType: RuntimeSourceType;
  startedAt: Date;
  updatedAt: Date;
  dataStatus: "FRESH" | "STALE";
  lastSuccessfulFetchAt: Date;
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

interface ApiPayload {
  applicationId: string;
  state: string;
  message: string;
  sourceType: string;
  startedAt: string;
  updatedAt: string;
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

  private mapSourceType(apiSourceType: string): RuntimeSourceType {
    const normalized = apiSourceType.replace(/^RUNTIME_STATE_SOURCE_/, '');
    const validSources: RuntimeSourceType[] = ["OPERATIONAL", "INCIDENT", "MAINTENANCE", "SIMULATION"];
    if (validSources.includes(normalized as RuntimeSourceType)) {
      return normalized as RuntimeSourceType;
    }
    throw new Error(`Unknown runtime source type: ${apiSourceType}`);
  }

  /**
   * Fetches the current runtime status.
   */
  async getRuntime(): Promise<RuntimeResponse> {
    const fetchFn = this.getFetchFn();
    const url = `${this.baseUrl}/runtimehq/v1/public/${this.runtimeKey}`;

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
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

    let payload: ApiPayload;
    try {
      payload = await response.json() as ApiPayload;
    } catch (err) {
      throw new Error(`Failed to parse JSON response: ${(err as Error).message}`);
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid response body: payload is not an object');
    }

    const lastFetchDate = new Date();
    const runtimeResponse: RuntimeResponse = {
      applicationId: payload.applicationId || '',
      state: this.mapState(payload.state || ''),
      message: payload.message || '',
      sourceType: this.mapSourceType(payload.sourceType || ''),
      startedAt: payload.startedAt ? new Date(payload.startedAt) : lastFetchDate,
      updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : lastFetchDate,
      dataStatus: "FRESH",
      lastSuccessfulFetchAt: lastFetchDate,
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
      : 15;

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
