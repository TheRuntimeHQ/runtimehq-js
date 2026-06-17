/**
 * Purpose: Monitor only selected capabilities such as payments, uploads, or reports.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

client.watchRuntime({
  onUpdate: (runtime) => {
    const payments = runtime.getCapabilityState("payments");
    if (payments && payments.state !== "OPERATIONAL") {
      console.warn(`Payments issue: ${payments.message}`);
    }
  }
});