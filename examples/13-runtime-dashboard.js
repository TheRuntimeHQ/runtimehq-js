/**
 * Purpose: Build an operational dashboard for one or more applications.
 */
import { RuntimeHQClient } from "@theruntimehq/js";

const app1Client = new RuntimeHQClient({ runtimeKey: "rt_prod_app1_key" });
const app2Client = new RuntimeHQClient({ runtimeKey: "rt_prod_app2_key" });

async function renderDashboard() {
  const [app1, app2] = await Promise.all([
    app1Client.getRuntime(),
    app2Client.getRuntime()
  ]);

  console.log(`App 1 (${app1.applicationId}) State: ${app1.state}`);
  console.log(`App 2 (${app2.applicationId}) State: ${app2.state}`);
}

renderDashboard();