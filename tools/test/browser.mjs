// Shared browser launcher for the test scripts.
//
// Default behaviour is unchanged: launch the installed Microsoft Edge via playwright-core
// (channel "msedge", no browser download) — the project's documented local workflow.
//
// For CI / headless Linux / remote dev environments where Edge isn't installed, two env
// vars let you point at any Chromium-family binary without editing the tests:
//   PJ_BROWSER_PATH    — absolute path to a chrome/chromium executable (overrides channel)
//   PJ_BROWSER_CHANNEL — playwright channel name (default "msedge"; e.g. "chrome")
import { chromium } from "playwright-core";

export function launchBrowser(opts = {}) {
  const execPath = process.env.PJ_BROWSER_PATH;
  const channel = process.env.PJ_BROWSER_CHANNEL || "msedge";
  const base = { headless: true, ...opts };
  // An explicit executable wins and must NOT be combined with a channel.
  if (execPath) return chromium.launch({ ...base, executablePath: execPath });
  return chromium.launch({ ...base, channel });
}
