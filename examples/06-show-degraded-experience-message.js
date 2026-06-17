/**
 * Purpose: Provide alternate messaging when a capability is degraded.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

async function checkSearch() {
  const runtime = await client.getRuntime();
  const search = runtime.getCapabilityState("search");

  if (search && search.state === "DEGRADED") {
    console.log(`Search is currently slower than usual: ${search.message}`);
  }
}

checkSearch();