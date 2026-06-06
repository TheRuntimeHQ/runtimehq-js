# RuntimeHQ JS SDK

we are building a public JavaScript SDK.

Repo - github.com/TheRuntimeHQ/runtimehq-js
package - npm install @theruntimehq/js

Platforms:

Node.js
Express
Fastify
NestJS
Next.js Server Components
Next.js API Routes
Vercel Functions
Cloudflare Workers
Bun
Deno
Vue
Angular
Svelte
Astro
plain JS

# Structure 
the SDK needs to wrap an API call -

```bash
curl -X GET \
  -H "Accept: application/json" \
  https://runtime.theruntimehq.com/runtimehq/v1/runtime/${runtimeKey}

```

Validations-
    1. runtimeKey must start with rt_prod_ or rt_test_


The API response code follows standard HTTP response code - 200 for success, 400 if the runtimeKey is invalid, 5xx for server error.

The API gives output like this-

```JSON
  {
  "applicationId": "app_019e8625-c3e4-7ab0-843e-730054f4efbe",
  "state": "RUNTIME_STATE_OPERATIONAL",
  "message": "All systems operational",
  "sourceType": "RUNTIME_STATE_SOURCE_OPERATIONAL",
  "startedAt": "2026-06-05T12:09:32.609Z",
  "updatedAt": "2026-06-05T12:09:32.611Z"
}
```
Abstract API response to a nicer developer experience-
1. API response state enums - 
    RUNTIME_STATE_OPERATIONAL => Application is healthy
    RUNTIME_STATE_MAINTENANCE => Application is under an active maintenance window
    RUNTIME_STATE_DEGRADED => Application is under an incident and experiencing issues
    RUNTIME_STATE_OUTAGE => Application is down
    SDK should have simplified state enums -OPERATIONAL, MAINTENANCE, DEGRADED, OUTAGE

2. API response sourceType enums-
    RUNTIME_STATE_SOURCE_OPERATIONAL => State is updated by an automated check when there are no active incidents or maintenance windows.
    RUNTIME_STATE_SOURCE_INCIDENT => State is updated by an incident
    RUNTIME_STATE_SOURCE_MAINTENANCE => State is updated by a maintenance window
    SDK should have simplified source enums - OPERATIONAL, INCIDENT, MAINTENANCE.
3. message (no change). It is customer facing message as updated on the active incident or maintaincen window
4. startedAt and updatedAt should be converted from string to date object.

## SDK Response

```typescript
type RuntimeResponse = {
  applicationId: string;

  state:
    | "OPERATIONAL"
    | "MAINTENANCE"
    | "DEGRADED"
    | "OUTAGE";

  message: string;

  sourceType:
    | "OPERATIONAL"
    | "INCIDENT"
    | "MAINTENANCE"
    | "SIMULATION";

  startedAt: Date;
  updatedAt: Date;

  dataStatus: "FRESH" | "STALE";
  lastSuccessfulFetchAt: Date;
};
```

## Installation
`npm install @theruntimehq/js`


## JS Frontend Simple Example

```javascript
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({
  runtimeKey: process.env.RUNTIMEHQ_KEY
});

const runtime = await client.getRuntime();

console.log(runtime);

if (runtime.state !== "OPERATIONAL") {
  document.getElementById("banner").innerText = runtime.message;
}
```

## Next.js Server Component Exmple

```javascript
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({
  runtimeKey: process.env.RUNTIMEHQ_RUNTIME_KEY,
});

export default async function Page() {
  const runtime = await client.getRuntime();

  return (
    <>
      {runtime.state !== "OPERATIONAL" && (
        <div className="banner">
          {runtime.message}
        </div>
      )}

      <main>Application Content</main>
    </>
  );
}
```


## JS Frontend Example With Subscriber

```javascript
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({
  runtimeKey: process.env.RUNTIMEHQ_KEY
});

const updateBannerMessage = (runtime) => {
  console.log(runtime);
  if (runtime.state !== "OPERATIONAL") {
    document.getElementById("banner").innerText = runtime.message;
  }
}

const runtime = await client.getRuntime();
updateBannerMessage(runtime);

//Listen for changes. Auto refresh every x seconds, if refresh fails -> return last known state, emit error event and continue polling.
const unsubscribe = client.watchRuntime({
  intervalSeconds: 15,
  onUpdate:updateBannerMessage,
  onError(error) {}
});

```