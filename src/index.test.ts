import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuntimeHQClient, RuntimeHQError, RuntimeResponse } from './index';

describe('RuntimeHQClient Constructor', () => {
  it('should throw error if options are missing', () => {
    expect(() => new (RuntimeHQClient as any)()).toThrow('Options object is required');
  });

  it('should throw error if runtimeKey is missing or not a string', () => {
    expect(() => new RuntimeHQClient({ runtimeKey: undefined as any })).toThrow('runtimeKey is required and must be a string');
    expect(() => new RuntimeHQClient({ runtimeKey: 12345 as any })).toThrow('runtimeKey is required and must be a string');
  });

  it('should throw error if runtimeKey does not start with rt_prod_ or rt_test_', () => {
    expect(() => new RuntimeHQClient({ runtimeKey: 'invalid_key' })).toThrow('runtimeKey must start with rt_prod_ or rt_test_');
    expect(() => new RuntimeHQClient({ runtimeKey: 'prod_rt_123' })).toThrow('runtimeKey must start with rt_prod_ or rt_test_');
  });

  it('should initialize correctly with valid runtimeKey', () => {
    const client = new RuntimeHQClient({ runtimeKey: 'rt_prod_12345' });
    expect(client).toBeInstanceOf(RuntimeHQClient);
  });

  it('should normalize baseUrl by trimming trailing slashes', () => {
    const client = new RuntimeHQClient({
      runtimeKey: 'rt_test_abc',
      baseUrl: 'https://custom-url.com///',
    });
    expect((client as any).baseUrl).toBe('https://custom-url.com');
  });
});

describe('RuntimeHQClient.getRuntime', () => {
  const mockPayload = {
    applicationId: 'app_123',
    state: 'RUNTIME_STATE_MAINTENANCE',
    message: 'System is under maintenance',
    capabilityStates: [
      {
        capabilityName: 'payments',
        state: 'RUNTIME_STATE_OUTAGE',
        message: 'Payments are down',
      }
    ],
    version: 1,
    updatedAt: '2026-06-05T12:30:00.000Z',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fetch, parse and map successful response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockPayload,
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new RuntimeHQClient({ runtimeKey: 'rt_prod_test' });
    const response = await client.getRuntime();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://edge.theruntimehq.com/runtimehq/v1/public/rt_prod_test',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })
    );

    expect(response.applicationId).toBe('app_123');
    expect(response.state).toBe('MAINTENANCE');
    expect(response.message).toBe('System is under maintenance');
    expect(response.version).toBe(1);
    expect(response.capabilityStates).toHaveLength(1);
    expect(response.updatedAt).toBeInstanceOf(Date);
    expect(response.updatedAt.toISOString()).toBe('2026-06-05T12:30:00.000Z');
    expect(response.dataStatus).toBe('FRESH');
    expect(response.lastSuccessfulFetchAt).toBeInstanceOf(Date);

    expect(client.getLastCachedResponse()).toEqual(response);
  });

  it('should correctly expose capability helper methods', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPayload,
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new RuntimeHQClient({ runtimeKey: 'rt_prod_test' });
    const response = await client.getRuntime();

    expect(typeof response.hasCapability).toBe('function');
    expect(typeof response.getCapabilityState).toBe('function');

    expect(response.hasCapability('payments')).toBe(true);
    expect(response.getCapabilityState('payments')).toEqual({
      capabilityName: 'payments',
      state: 'OUTAGE',
      message: 'Payments are down'
    });

    expect(response.hasCapability('non-existent')).toBe(false);
    expect(response.getCapabilityState('non-existent')).toBeUndefined();
  });

  it('should throw an error for unknown state', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...mockPayload,
        state: 'RUNTIME_STATE_UNKNOWN',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new RuntimeHQClient({ runtimeKey: 'rt_prod_test' });
    await expect(client.getRuntime()).rejects.toThrow('Unknown runtime state: RUNTIME_STATE_UNKNOWN');
  });

  it('should handle custom fetch configuration option', async () => {
    const customFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPayload,
    });

    const client = new RuntimeHQClient({
      runtimeKey: 'rt_prod_test',
      fetch: customFetchMock,
    });
    const response = await client.getRuntime();
    expect(customFetchMock).toHaveBeenCalled();
    expect(response.applicationId).toBe('app_123');
  });

  it('should throw RuntimeHQError when non-2xx status code is returned', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ message: 'Invalid runtime key signature' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new RuntimeHQClient({ runtimeKey: 'rt_prod_test' });

    await expect(client.getRuntime()).rejects.toThrowError(
      expect.objectContaining({
        name: 'RuntimeHQError',
        status: 400,
        statusText: 'Bad Request',
        message: 'Invalid runtime key signature',
      })
    );
  });

  it('should throw RuntimeHQError with status text fallback if JSON message is missing', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => { throw new Error('Not JSON'); },
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new RuntimeHQClient({ runtimeKey: 'rt_prod_test' });

    await expect(client.getRuntime()).rejects.toThrowError(
      expect.objectContaining({
        name: 'RuntimeHQError',
        status: 500,
        statusText: 'Internal Server Error',
        message: 'Request failed with status 500',
      })
    );
  });

  it('should wrap network request failures in a generic Error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', mockFetch);

    const client = new RuntimeHQClient({ runtimeKey: 'rt_prod_test' });

    await expect(client.getRuntime()).rejects.toThrow('Network request failed: Failed to fetch');
  });
});

describe('RuntimeHQClient.watchRuntime', () => {
  const mockPayload = {
    applicationId: 'app_123',
    state: 'RUNTIME_STATE_OPERATIONAL',
    message: 'Operational',
    capabilityStates: [],
    version: 1,
    updatedAt: '2026-06-05T12:30:00.000Z',
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should trigger initial fetch immediately and call onUpdate on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPayload,
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new RuntimeHQClient({ runtimeKey: 'rt_prod_test' });

    await new Promise<void>((resolve) => {
      client.watchRuntime({
        onUpdate: (res) => {
          expect(res.state).toBe('OPERATIONAL');
          expect(res.dataStatus).toBe('FRESH');
          resolve();
        },
        intervalSeconds: 5,
      });
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should periodically poll at defined intervals', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...mockPayload,
          message: `Poll count: ${callCount}`,
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new RuntimeHQClient({ runtimeKey: 'rt_prod_test' });
    const onUpdate = vi.fn();

    let resolveUpdate: (() => void) | null = null;
    onUpdate.mockImplementation(() => {
      if (resolveUpdate) resolveUpdate();
    });

    const updatePromise = () => new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });

    const unsubscribe = client.watchRuntime({
      onUpdate,
      intervalSeconds: 10,
    });

    // Wait for the first update (initial call)
    await updatePromise();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].message).toBe('Poll count: 1');

    // Advance time by 10s to trigger first poll interval
    const p2 = updatePromise();
    vi.advanceTimersByTime(10000);
    await p2;
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[1][0].message).toBe('Poll count: 2');

    // Advance time by another 10s
    const p3 = updatePromise();
    vi.advanceTimersByTime(10000);
    await p3;
    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(onUpdate.mock.calls[2][0].message).toBe('Poll count: 3');

    // Unsubscribe and advance time, no more polls should execute
    unsubscribe();
    vi.advanceTimersByTime(10000);
    expect(onUpdate).toHaveBeenCalledTimes(3);
  });

  it('should call onError and emit STALE state if a subsequent poll fails', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => mockPayload,
        };
      } else {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        };
      }
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new RuntimeHQClient({ runtimeKey: 'rt_prod_test' });
    const onUpdate = vi.fn();
    const onError = vi.fn();

    let resolveUpdate: (() => void) | null = null;
    onUpdate.mockImplementation(() => {
      if (resolveUpdate) resolveUpdate();
    });

    let resolveError: (() => void) | null = null;
    onError.mockImplementation(() => {
      if (resolveError) resolveError();
    });

    const updatePromise = () => new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });

    const errorPromise = () => new Promise<void>((resolve) => {
      resolveError = resolve;
    });

    client.watchRuntime({
      onUpdate,
      onError,
      intervalSeconds: 5,
    });

    // Run initial fetch (success)
    await updatePromise();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].dataStatus).toBe('FRESH');
    expect(onError).not.toHaveBeenCalled();

    // Trigger next fetch (failure #1)
    const p2 = updatePromise();
    vi.advanceTimersByTime(5000);
    await p2;

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(RuntimeHQError);

    // Should emit the cached state as STALE
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[1][0].dataStatus).toBe('STALE');
    expect(onUpdate.mock.calls[1][0].message).toBe('Operational');
    expect(typeof onUpdate.mock.calls[1][0].hasCapability).toBe('function');

    // Trigger another fetch (failure #2)
    const p3 = errorPromise();
    vi.advanceTimersByTime(5000);
    await p3;

    // Error callback is triggered again
    expect(onError).toHaveBeenCalledTimes(2);
    // onUpdate should NOT be called again (remains 2) to prevent unnecessary re-renders
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('should call onError but NOT onUpdate if initial fetch fails and no cache exists', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new RuntimeHQClient({ runtimeKey: 'rt_prod_test' });
    const onUpdate = vi.fn();
    const onError = vi.fn();

    await new Promise<void>((resolve) => {
      client.watchRuntime({
        onUpdate,
        onError: (err) => {
          onError(err);
          resolve();
        },
        intervalSeconds: 5,
      });
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
