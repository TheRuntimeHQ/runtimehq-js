# @theruntimehq/js

[![npm version](https://img.shields.io/npm/v/@theruntimehq/js.svg)](https://www.npmjs.com/package/@theruntimehq/js)
[![license](https://img.shields.io/npm/l/@theruntimehq/js.svg)](https://github.com/TheRuntimeHQ/runtimehq-js/blob/main/LICENSE)

The official JavaScript & TypeScript SDK for [RuntimeHQ](https://theruntimehq.com). Keep your users informed during service disruptions, planned maintenance windows, or outages with real-time status banner updates.

Zero dependencies, universal, and fully compatible with Node.js, Next.js, Cloudflare Workers, Deno, Bun, and browsers.

---

## Table of Contents

- [Installation](#installation)
- [Configuration Options](#configuration-options)
- [SDK Response Structure](#sdk-response-structure)
- [Simple Example (Plain JS/HTML)](#simple-example-plain-jshtml)
- [Next.js Server Components Example](#next-js-server-components-example)
- [Advanced Example with Subscriber (Auto-Refresh & Error Recovery)](#advanced-example-with-subscriber-auto-refresh--error-recovery)
- [Diverse Use Cases](#diverse-use-cases)
  - [Express / Fastify Route Safeguard](#express--fastify-route-safeguard)
  - [Cloudflare Workers Edge Status Check](#cloudflare-workers-edge-status-check)
  - [Deno / Bun Integration](#deno--bun-integration)
  - [React State Hook Example](#react-state-hook-example)
- [Error Handling](#error-handling)

---

## Installation

Install using your preferred package manager:

```bash
npm install @theruntimehq/js
# or
yarn add @theruntimehq/js
# or
pnpm add @theruntimehq/js
# or
bun add @theruntimehq/js
```

---

## Configuration Options

Pass these options to the `RuntimeHQClient` constructor:

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `runtimeKey` | `string` | **Yes** | Your API status key. Must start with `rt_prod_` or `rt_test_`. |
| `fetch` | `typeof fetch` | No | Inject a custom fetch implementation (useful for legacy Node environments). |

---

## SDK Response Structure

All client methods return status details mapped into a clean TypeScript structure:

```typescript
type RuntimeResponse = {
  // Unique application identifier
  applicationId: string;

  // Normalized application status
  state: "OPERATIONAL" | "MAINTENANCE" | "DEGRADED" | "OUTAGE";

  // Customer-facing status message
  message: string;

  // The origin source trigger for the current state
  sourceType: "OPERATIONAL" | "INCIDENT" | "MAINTENANCE" | "SIMULATION";

  // Timestamps converted to Date objects
  startedAt: Date;
  updatedAt: Date;

  // Status indicators for cached/polled responses
  dataStatus: "FRESH" | "STALE";
  lastSuccessfulFetchAt: Date;
};
```

---

## Simple Example (Plain JS/HTML)

Perfect for standard frontend pages. Instantiate the client and query the latest status:

```javascript
import { RuntimeHQClient } from "@theruntimehq/js";

// Initialize the client
const client = new RuntimeHQClient({
  runtimeKey: "rt_prod_your_key_here",
});

async function checkStatus() {
  try {
    const runtime = await client.getRuntime();
    console.log("Current application status:", runtime);

    const banner = document.getElementById("banner");
    
    if (runtime.state !== "OPERATIONAL") {
      banner.style.display = "block";
      banner.innerText = runtime.message;
      banner.className = `status-banner status-${runtime.state.toLowerCase()}`;
    } else {
      banner.style.display = "none";
    }
  } catch (error) {
    console.error("Failed to fetch runtime status:", error);
  }
}

checkStatus();
```

---

## Next.js Server Components Example

Fetch the runtime status directly on the server during Server-Side Rendering (SSR). This prevents UI layout shifts by rendering status banners on the initial request.

```typescript
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({
  runtimeKey: process.env.RUNTIMEHQ_RUNTIME_KEY!,
});

export default async function Page() {
  // Fetches status server-side during rendering
  const runtime = await client.getRuntime();

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {runtime.state !== "OPERATIONAL" && (
        <div className={`p-4 text-center text-sm font-semibold ${
          runtime.state === "OUTAGE" ? "bg-red-600" :
          runtime.state === "DEGRADED" ? "bg-amber-600" : "bg-blue-600"
        }`}>
          ⚠️ {runtime.message} (Started at: {runtime.startedAt.toLocaleDateString()})
        </div>
      )}

      <main className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold">My Production Dashboard</h1>
        <p className="mt-4 text-slate-400">Welcome to your app content.</p>
      </main>
    </div>
  );
}
```

---

## Advanced Example with Subscriber (Auto-Refresh & Error Recovery)

Use `watchRuntime` to continuously listen for status changes. If a refresh fails (due to a transient network issue), the subscriber returns the last known successful state marked as `"STALE"`, fires an error callback, and continues polling.

```javascript
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({
  runtimeKey: "rt_prod_your_key_here",
});

const banner = document.getElementById("status-banner");

// Callback to handle successful fetches and fallback states
function updateUI(runtime) {
  const isStale = runtime.dataStatus === "STALE";
  
  if (runtime.state !== "OPERATIONAL") {
    banner.style.display = "block";
    banner.innerText = `${runtime.message}${isStale ? " (Showing cached status - Offline)" : ""}`;
    banner.className = `status-banner status-${runtime.state.toLowerCase()} ${isStale ? "stale" : ""}`;
  } else {
    banner.style.display = "none";
  }
}

// Start polling status every 15 seconds
const unsubscribe = client.watchRuntime({
  intervalSeconds: 15,
  onUpdate: updateUI,
  onError(error) {
    console.warn("Status polling error (recovering):", error.message);
  }
});

// To stop listening and clean up timer resource:
// unsubscribe();
```

---

## Diverse Use Cases

### Express / Fastify Route Safeguard

Redirect users to a maintenance page or block write operations if the application status is in an active `OUTAGE` or `MAINTENANCE` state:

```javascript
import express from "express";
import { RuntimeHQClient } from "@theruntimehq/js";

const app = express();
const client = new RuntimeHQClient({ runtimeKey: process.env.RUNTIMEHQ_KEY });

// Express Middleware
const maintenanceGuard = async (req, res, next) => {
  try {
    const runtime = await client.getRuntime();
    
    if (runtime.state === "OUTAGE" || runtime.state === "MAINTENANCE") {
      return res.status(503).json({
        error: "Service Unavailable",
        message: runtime.message,
        status: runtime.state,
      });
    }
  } catch (err) {
    // Fail-open: Let requests pass if status API itself is offline
    console.error("Status check failed, passing request:", err);
  }
  next();
};

app.use("/api/v1/write-operations", maintenanceGuard);
```

### Cloudflare Workers Edge Status Check

Execute status checks at the edge using Cloudflare Workers:

```typescript
import { RuntimeHQClient } from "@theruntimehq/js";

export interface Env {
  RUNTIMEHQ_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const client = new RuntimeHQClient({
      runtimeKey: env.RUNTIMEHQ_KEY,
    });

    try {
      const runtime = await client.getRuntime();
      
      return new Response(JSON.stringify({ 
        status: "success", 
        runtime 
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        status: "error", 
        message: error instanceof Error ? error.message : "Fetch error" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
```

### Deno / Bun Integration

The SDK works natively out-of-the-box in Bun and Deno since it uses standard ESM packaging and the global `fetch` API:

```typescript
// Bun Example
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({
  runtimeKey: Bun.env.RUNTIMEHQ_KEY
});

const runtime = await client.getRuntime();
console.log(`State: ${runtime.state}`);
```

```typescript
// Deno Example (using npm specifier)
import { RuntimeHQClient } from "npm:@theruntimehq/js";

const client = new RuntimeHQClient({
  runtimeKey: Deno.env.get("RUNTIMEHQ_KEY") || ""
});

const runtime = await client.getRuntime();
console.log(`State: ${runtime.state}`);
```

### React State Hook Example

Create a reactive React hook to bind status info directly to your components:

```typescript
import { useState, useEffect } from "react";
import { RuntimeHQClient, RuntimeResponse } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

export function useRuntimeHQ(intervalSeconds = 30) {
  const [runtime, setRuntime] = useState<RuntimeResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = client.watchRuntime({
      intervalSeconds,
      onUpdate: (data) => {
        setRuntime(data);
        setError(null);
      },
      onError: (err) => {
        setError(err);
      }
    });

    return () => unsubscribe();
  }, [intervalSeconds]);

  return { runtime, error, isOffline: runtime?.dataStatus === "STALE" };
}
```

---

## Error Handling

When an API call returns a non-2xx status code, the SDK throws a `RuntimeHQError` containing the underlying HTTP status information:

```javascript
import { RuntimeHQClient, RuntimeHQError } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_invalid_key" });

try {
  await client.getRuntime();
} catch (error) {
  if (error instanceof RuntimeHQError) {
    console.error(`API Error Code: ${error.status}`); // e.g. 400
    console.error(`Status text: ${error.statusText}`);  // e.g. "Bad Request"
    console.error(`Server message: ${error.message}`); // Detailed error description
  } else {
    console.error("Generic or network error:", error.message);
  }
}
```

## License

MIT
