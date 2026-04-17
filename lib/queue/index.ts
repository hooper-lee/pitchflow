import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

const connection = getRedisConnection();

export const emailSendQueue = new Queue("email-send", { connection });
export const followUpQueue = new Queue("follow-up", { connection });
export const researchQueue = new Queue("prospect-research", { connection });
export const alertQueue = new Queue("alert-dispatch", { connection });
