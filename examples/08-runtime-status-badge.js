/**
 * Purpose: Display a compact operational status indicator.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

async function getBadgeColor() {
  const runtime = await client.getRuntime();
  const colors = {
    "OPERATIONAL": "green",
    "DEGRADED": "yellow",
    "MAINTENANCE": "blue",
    "OUTAGE": "red"
  };
  
  console.log(`Badge Color: ${colors[runtime.state]}`);
}

getBadgeColor();