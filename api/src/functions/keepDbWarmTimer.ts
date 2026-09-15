import { app, InvocationContext, Timer } from "@azure/functions";
import { getPool } from "../db/pool.js";

// Runs on Azure's own scheduler rather than an external GitHub Actions
// cron, which was found to fire far less often than configured (7 of an
// expected ~34 daily runs actually executed) — a known limitation of
// GitHub's free scheduled-workflow queue. Keeps mayomilesql1 (Azure SQL
// Serverless) from auto-pausing, and keeps this Function host itself
// active, since both contribute to the "stopped host" issue documented in
// README.md's Known Issues. Supplements (doesn't replace) the GitHub
// Actions ping and the scheduled redeploy — belt and suspenders, since
// none of these fully fix the underlying platform instability on their
// own.
export async function keepDbWarmTimer(myTimer: Timer, context: InvocationContext): Promise<void> {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1");
    context.log("keepDbWarmTimer: ping succeeded");
  } catch (err) {
    context.error("keepDbWarmTimer: ping failed", err);
  }
}

app.timer("keepDbWarmTimer", {
  // Every 15 minutes, roughly 4am-9pm Central across DST (UTC 10-23,0-2 —
  // matches the GitHub Actions ping window this supplements). NCRONTAB:
  // {second} {minute} {hour} {day} {month} {day-of-week}.
  schedule: "0 */15 10-23,0-2 * * *",
  handler: keepDbWarmTimer,
});
