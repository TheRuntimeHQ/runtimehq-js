/**
 * Purpose: Prevent a critical workflow when a dependency is unavailable.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

async function renderCheckout() {
  const runtime = await client.getRuntime();
  const payments = runtime.getCapabilityState("payments");

  if (payments && payments.state !== "OPERATIONAL") {
    console.log(`Checkout disabled: ${payments.message}`);
  } else {
    console.log("Checkout available. Proceed to payment.");
  }
}

renderCheckout();