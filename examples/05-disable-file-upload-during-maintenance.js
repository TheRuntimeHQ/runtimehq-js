/**
 * Purpose: Disable a specific workflow during maintenance.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

async function renderUploadForm() {
  const runtime = await client.getRuntime();
  const uploads = runtime.getCapabilityState("file-uploads");

  if (uploads && uploads.state === "MAINTENANCE") {
    console.log(`Uploads temporarily disabled for maintenance: ${uploads.message}`);
  } else {
    console.log("Render file upload form");
  }
}

renderUploadForm();