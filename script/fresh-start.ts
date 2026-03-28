import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DB_FILE = path.join(ROOT, "data.db");
const PORT = 5000;

function log(msg: string) {
  console.log(`\x1b[36m[fresh-start]\x1b[0m ${msg}`);
}

// 1. Kill process occupying the port
try {
  const output = execSync(
    `netstat -ano | findstr ":${PORT}" | findstr "LISTENING"`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  );
  const pids = new Set<string>();
  for (const line of output.trim().split("\n")) {
    const pid = line.trim().split(/\s+/).pop();
    if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
  }
  for (const pid of pids) {
    log(`终止占用端口 ${PORT} 的进程 PID=${pid}`);
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } catch {}
  }
  if (pids.size > 0) {
    log("等待端口释放...");
    execSync("timeout /T 2 /NOBREAK > NUL", { stdio: "ignore" });
  }
} catch {
  log(`端口 ${PORT} 空闲，无需清理`);
}

// 2. Delete data.db (and WAL/SHM files)
for (const suffix of ["", "-wal", "-shm"]) {
  const f = DB_FILE + suffix;
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    log(`已删除 ${path.basename(f)}`);
  }
}

// 3. Start dev server
log("启动开发服务器...\n");
const child = spawn("npx", ["cross-env", "NODE_ENV=development", "tsx", "server/index.ts"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 1));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
