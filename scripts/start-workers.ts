import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function startWorkers() {
  await import("@/lib/queue/workers/send-email.worker");
  await import("@/lib/queue/workers/followup.worker");
  await import("@/lib/queue/workers/research.worker");
  await import("@/lib/queue/workers/alert.worker");
  await import("@/lib/queue/workers/discovery.worker");
}

function logWorkerStartup() {
  console.log("[workers] PitchFlow queue workers started");
}

function keepWorkersAlive() {
  setInterval(() => {
    void 0;
  }, 60 * 60 * 1000);
}

void startWorkers().then(() => {
  logWorkerStartup();
  keepWorkersAlive();
});
