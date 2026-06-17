/**
 * Purpose: Explain why a specific feature is unavailable.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

async function renderTransferButton() {
  const runtime = await client.getRuntime();
  const transfers = runtime.getCapabilityState("transfers");

  if (transfers && transfers.state === "OUTAGE") {
    console.log(`[Button Disabled] Tooltip: ${transfers.message}`);
  } else {
    console.log("[Button Enabled] Transfer Funds");
  }
}

renderTransferButton();