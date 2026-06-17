/**
 * Purpose: Convert the application into read-only mode during outages.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

async function performWriteOperation(data) {
  const runtime = await client.getRuntime();
  if (runtime.state === "MAINTENANCE" || runtime.state === "OUTAGE") {
    throw new Error(`System is in read-only mode: ${runtime.message}`);
  }
  
  console.log("Writing data...", data);
}

performWriteOperation({ id: 1 }).catch(console.error);