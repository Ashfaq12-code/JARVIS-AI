const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const frontend = path.join(root, "frontend");
const nextCli = path.join(frontend, "node_modules", "next", "dist", "bin", "next");
const venvPython = path.join(root, ".venv", "Scripts", "python.exe");
const python = fs.existsSync(venvPython) ? venvPython : "python";
const children = [];
let stopping = false;

function stopAll(exitCode) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  process.exitCode = exitCode;
}

function startService(name, command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${name} failed to start: ${error.message}`);
    stopAll(1);
  });
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(`${name} stopped${signal ? ` (${signal})` : ` with exit code ${code}`}.`);
      stopAll(code || 1);
    }
  });
}

if (!fs.existsSync(nextCli)) {
  console.error("Frontend dependencies are missing. Run `npm --prefix frontend install` first.");
  process.exit(1);
}

console.log("Starting JARVIS backend at http://127.0.0.1:8001");
startService("JARVIS backend", python, [
  "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8001",
], root);

console.log("Starting JARVIS frontend at http://localhost:3000");
startService("JARVIS frontend", process.execPath, [nextCli, "dev", "-p", "3000"], frontend);

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));