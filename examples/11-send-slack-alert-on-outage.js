/**
 * Purpose: Push runtime changes into operational workflows.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

let previousState = null;

client.watchRuntime({
  onUpdate: (runtime) => {
    if (previousState !== runtime.state && runtime.state === "OUTAGE") {
      // Replace with your Slack webhook logic
      console.log(`Sending to Slack: 🚨 Application OUTAGE detected: ${runtime.message}`);
    }
    previousState = runtime.state;
  }
});