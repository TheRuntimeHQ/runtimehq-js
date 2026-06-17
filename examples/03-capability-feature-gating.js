/**
 * Purpose: Hide or show features based on capability state.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

async function loadDashboard() {
  const runtime = await client.getRuntime();
  const reports = runtime.getCapabilityState("advanced-reports");

  if (!reports || reports.state !== "OPERATIONAL") {
    console.log("Hiding advanced reports tab.");
  } else {
    console.log("Showing advanced reports tab.");
  }
}

loadDashboard();