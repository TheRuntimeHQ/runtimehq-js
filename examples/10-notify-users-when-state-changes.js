/**
 * Purpose: Detect version changes and react to runtime transitions.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

let lastVersion = -1;

client.watchRuntime({
  intervalSeconds: 60,
  onUpdate: (runtime) => {
    if (lastVersion !== -1 && runtime.version > lastVersion) {
      console.log(`State changed! New state: ${runtime.state}. Message: ${runtime.message}`);
    }
    lastVersion = runtime.version;
  }
});