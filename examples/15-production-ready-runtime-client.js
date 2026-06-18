/**
 * Purpose: Complete production example covering initialization, refresh, reconciliation, and resilience.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

class RuntimeManager {
  constructor(key) {
    this.client = new RuntimeHQClient({ runtimeKey: key });
    this.state = null;
  }

  start() {
    this.unsubscribe = this.client.watchRuntime({
      intervalSeconds: 60,
      onUpdate: (runtime) => {
        this.state = runtime;
        console.log(`[Production] Synced state: ${runtime.state}`);
      },
      onError: (err) => {
        console.error(`[Production] Failed to sync runtime state: ${err.message}`);
      }
    });
  }

  stop() {
    if (this.unsubscribe) this.unsubscribe();
  }

  isFeatureAvailable(featureName) {
    if (!this.state) return true; // Fail-open pattern
    const cap = this.state.getCapabilityState(featureName);
    return !cap || cap.state === "OPERATIONAL";
  }
}

const manager = new RuntimeManager("rt_prod_your_key");
manager.start();