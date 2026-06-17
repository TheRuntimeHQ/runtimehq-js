/**
 * Purpose: Build a customer-facing status page using RuntimeHQ.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const client = new RuntimeHQClient({ runtimeKey: "rt_prod_your_key" });

async function generateStatusPage() {
  const runtime = await client.getRuntime();
  
  const html = `
    <h1>System Status: ${runtime.state}</h1>
    <p>${runtime.message}</p>
    <ul>
      ${runtime.capabilityStates.map(c => `<li>${c.capabilityName}: ${c.state}</li>`).join('')}
    </ul>
  `;
  
  console.log(html);
}

generateStatusPage();