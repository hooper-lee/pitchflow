import "@/lib/queue/workers/send-email.worker";
import "@/lib/queue/workers/followup.worker";
import "@/lib/queue/workers/research.worker";
import "@/lib/queue/workers/alert.worker";

function logWorkerStartup() {
  console.log("[workers] PitchFlow queue workers started");
}

function keepWorkersAlive() {
  setInterval(() => {
    void 0;
  }, 60 * 60 * 1000);
}

logWorkerStartup();
keepWorkersAlive();
