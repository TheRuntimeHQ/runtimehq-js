/**
 * Purpose: Surface RuntimeHQ state in a command-line tool.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

async function runCLICommand() {
  const runtime = await client.getRuntime();
  if (runtime.state !== "OPERATIONAL") {
    console.error(`Warning: API is currently ${runtime.state}. Command may fail.`);
    console.error(`Reason: ${runtime.message}`);
    process.exit(1);
  }
  
  console.log("Running command successfully...");
}

runCLICommand();