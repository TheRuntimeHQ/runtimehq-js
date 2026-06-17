/**
 * Purpose: Show a site-wide banner when the application is not operational.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

async function init() {
  const runtime = await client.getRuntime();
  if (runtime.state !== "OPERATIONAL") {
    console.log(`[BANNER] ${runtime.message}`);
  }
}

init();