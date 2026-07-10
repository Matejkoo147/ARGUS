#!/usr/bin/env node
/**
 * Cursor stop hook — commit and push when the agent finishes and the tree is dirty.
 * Skips sensitive paths (.env, keys). Push failures are logged but do not block the agent.
 */
const { execSync } = require("child_process");

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function drainStdin() {
  return new Promise((resolve) => {
    if (process.stdin.readableEnded) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}

const BLOCKED = [
  /^\.env$/i,
  /^\.env\./i,
  /credentials/i,
  /\.key$/i,
  /tls\/.*\.key$/i,
];

function isBlocked(path) {
  return BLOCKED.some((re) => re.test(path.replace(/\\/g, "/")));
}

async function main() {
  await drainStdin();

  try {
    const porcelain = run("git status --porcelain");
    if (!porcelain) return;

    const changedPaths = porcelain
      .split("\n")
      .filter(Boolean)
      .map((line) => line.slice(3).trim().replace(/^"\{(.+)\}"$/, "$1"));

    if (changedPaths.some(isBlocked)) {
      console.error("[auto-commit] skipped: sensitive files in working tree");
      return;
    }

    run("git add -A");
    const staged = run("git diff --cached --name-only");
    if (!staged) return;

    const names = staged.split("\n").filter(Boolean);
    if (names.some(isBlocked)) {
      run("git reset HEAD");
      console.error("[auto-commit] skipped: sensitive files staged");
      return;
    }

    const summary =
      names.length <= 3
        ? names.join(", ")
        : `${names.slice(0, 3).join(", ")} (+${names.length - 3} more)`;
    const message = `Auto: ${summary}`;

    run(`git commit -m ${JSON.stringify(message)}`);

    try {
      run("git push");
      console.error(`[auto-commit] pushed: ${message}`);
    } catch (pushErr) {
      const detail = pushErr.stderr || pushErr.message || String(pushErr);
      console.error(`[auto-commit] commit ok, push failed: ${detail}`);
    }
  } catch (err) {
    const detail = err.stderr || err.message || String(err);
    if (!/nothing to commit|no changes added/i.test(detail)) {
      console.error(`[auto-commit] ${detail}`);
    }
  }
}

main();
