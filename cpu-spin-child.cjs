/**
 * Dedicated Node child process: keeps one OS thread saturated until SIGTERM/SIGINT.
 * Spawned only from the admin DR demo (`cpu-load-simulator`), never as a standalone service.
 */

"use strict";

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

function slice() {
  const until = Date.now() + 60;
  let acc = 0;
  while (Date.now() < until) acc += Math.hypot(Math.random(), Math.random());
  return acc;
}

setImmediate(function loop() {
  slice();
  setImmediate(loop);
});
