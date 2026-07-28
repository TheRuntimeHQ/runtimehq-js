# @theruntimehq/js

[![npm version](https://img.shields.io/npm/v/@theruntimehq/js.svg)](https://www.npmjs.com/package/@theruntimehq/js)
[![license](https://img.shields.io/npm/l/@theruntimehq/js.svg)](https://github.com/TheRuntimeHQ/runtimehq-js/blob/main/LICENSE)

The official [JavaScript & TypeScript SDK for RuntimeHQ](https://docs.theruntimehq.com/runtime-sdks/js) to consume the Operation State of the application and react to it. Keep your users aware during service disruptions, planned maintenance windows, or outages with real-time state updates.

Zero dependencies, universal, and fully compatible with Node.js, Next.js, Cloudflare Workers, Deno, Bun, and browsers.

---

## Table of Contents

- [Installation](#installation)
- [Configuration Options](#configuration-options)
- [SDK Response Structure](#sdk-response-structure)
- [Simple Example (Plain JS/HTML)](#simple-example-plain-jshtml)
- [Examples Directory](#examples-directory)
- [React SDK](#react-sdk)
- [Error Handling](#error-handling)
- [License](#license)

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
| `runtimeKey` | `string` | **Yes** | The [Runtime Key](https://docs.theruntimehq.com/runtime-keys) required to get the resolved operational state of the application's capabilities. This is a public, read-only key that is absolutely safe for client-side exposure or browser environments. |
| `fetch` | `typeof fetch` | No | Inject a custom fetch implementation (useful for legacy Node environments). |

---

## SDK Response Structure

All client methods return status details mapped into a clean TypeScript structure:

```typescript
type CapabilityState = {
  capabilityName: string;
  state: "OPERATIONAL" | "MAINTENANCE" | "DEGRADED" | "OUTAGE";
  message: string;
};

type RuntimeResponse = {
  // Unique application identifier
  applicationId: string;

  // Normalized application status
  state: "OPERATIONAL" | "MAINTENANCE" | "DEGRADED" | "OUTAGE";

  // Customer-facing status message
  message: string;

  // Computed state for each capability
  capabilityStates: CapabilityState[];

  // Payload sequence version
  version: number;

  // The runtime state represented by this payload was last changed/evaluated at this timestamp.
  updatedAt: Date;

  // Status indicators for cached/polled responses
  dataStatus: "FRESH" | "STALE";
  lastSuccessfulFetchAt: Date;

  // Helper methods for capability states
  hasCapability(name: string): boolean;
  getCapabilityState(name: string): CapabilityState | undefined;
};
```

---

## Simple Example (Plain JS/HTML)

Perfect for a simple application-wide banner. Instantiate the client and query the latest status:

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

## Examples Directory

For more advanced use cases, integrations, and patterns, check out our [examples directory](./examples) which includes:
| File Name | Purpose |
| :--- | :--- |
| `01-application-wide-banner.js` | Show a site-wide banner when the application is not operational. |
| `02-capability-outage-tooltip.js` | Explain why a specific feature is unavailable. |
| `03-capability-feature-gating.js` | Hide or show features based on capability state. |
| `04-disable-checkout-when-payments-down.js` | Prevent a critical workflow when a dependency is unavailable. |
| `05-disable-file-upload-during-maintenance.js` | Disable a specific workflow during maintenance. |
| `06-show-degraded-experience-message.js` | Provide alternate messaging when a capability is degraded. |
| `07-fallback-to-read-only-mode.js` | Convert the application into read-only mode during outages. |
| `08-runtime-status-badge.js` | Display a compact operational status indicator. |
| `09-public-status-page.js` | Build a customer-facing status page using RuntimeHQ. |
| `10-notify-users-when-state-changes.js` | Detect version changes and react to runtime transitions. |
| `11-send-slack-alert-on-outage.js` | Push runtime changes into operational workflows. |
| `12-monitor-specific-capabilities.js` | Monitor only selected capabilities such as payments, uploads, or reports. |
| `13-runtime-dashboard.js` | Build an operational dashboard for one or more applications. |
| `14-runtime-aware-cli.js` | Surface RuntimeHQ state in a command-line tool. |
| `15-production-ready-runtime-client.js` | Complete production example covering initialization, refresh, reconciliation, and resilience. |

---

## React SDK

For React applications, we recommend using our official React SDK.

Check out the [@theruntimehq/react SDK here](https://github.com/TheRuntimeHQ/runtimehq-react).
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
