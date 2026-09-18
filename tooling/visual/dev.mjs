import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const workspace = resolve(import.meta.dirname, "../..");
const vite = resolve(workspace, "node_modules/vite/bin/vite.js");
const gallery = "http://127.0.0.1:5173/tooling/visual/gallery.html";
const apps = [
  {
    framework: "react",
    directory: "reference",
    port: 5181,
    title: "React source visual reference",
  },
  {
    framework: "solid",
    directory: "solid",
    port: 5182,
    title: "Solid source visual reference",
  },
];
const pause = (milliseconds) =>
  new Promise((done) => setTimeout(done, milliseconds));

async function requireDependencies() {
  try {
    await access(vite);
  } catch {
    throw new Error(
      "Workspace dependencies are missing. Run `npm ci` from the project root, then run `npm run visual:dev`.",
    );
  }
  const reference = resolve(import.meta.dirname, "apps/reference");
  const manifest = JSON.parse(
    await readFile(resolve(reference, "package.json"), "utf8"),
  );
  const missing = [];
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    try {
      await access(resolve(reference, "node_modules", name, "package.json"));
    } catch {
      missing.push(name);
    }
  }
  if (missing.length)
    throw new Error(
      `Reference dependencies are missing: ${missing.join(", ")}. Run \`npm run visual:setup\` from the project root, then run \`npm run visual:dev\`. The Solid documentation icons and fonts also use these reference dependencies.`,
    );
}

/** A title alone is not sufficient: the served entry must use this workspace. */
export async function inspectVisualServer(app) {
  const url = `http://127.0.0.1:${app.port}`;
  let response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(2500),
      redirect: "error",
    });
  } catch (error) {
    if (error.cause?.code === "ECONNREFUSED") return { state: "absent", url };
    return {
      state: "occupied",
      url,
      reason: `Cannot identify the server: ${error.message}`,
    };
  }
  const html = await response.text();
  if (
    !response.ok ||
    !html.includes(`<title>${app.title}</title>`) ||
    !html.includes('id="visual-case"')
  )
    return {
      state: "occupied",
      url,
      reason: "The response is not the expected visual app.",
    };
  try {
    const entry = await fetch(`${url}/main.tsx`, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    const source = await entry.text();
    const expected = `${workspace}/base-ui/packages/${app.framework}/src/index.ts`;
    if (
      !entry.ok ||
      !(source.includes(expected) || source.includes(encodeURI(expected)))
    )
      return {
        state: "occupied",
        url,
        reason:
          "The entry module failed to load or does not use this workspace.",
      };
  } catch (error) {
    return {
      state: "occupied",
      url,
      reason: `Cannot verify the entry module: ${error.message}`,
    };
  }
  return { state: "matching", url };
}

export async function runVisualDev() {
  const owned = new Set();
  let stopping = false;
  let keepAlive;
  let finish;
  const finished = new Promise((done) => {
    finish = done;
  });
  async function shutdown(exitCode) {
    if (stopping) return;
    stopping = true;
    clearInterval(keepAlive);
    for (const child of owned)
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGTERM");
    await Promise.all(
      [...owned].map(async (child) => {
        const deadline = Date.now() + 5000;
        while (
          child.exitCode === null &&
          child.signalCode === null &&
          Date.now() < deadline
        )
          await pause(50);
        if (child.exitCode === null && child.signalCode === null)
          child.kill("SIGKILL");
      }),
    );
    process.exitCode = exitCode;
    finish();
  }
  const interrupt = () => {
    void shutdown(0);
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  try {
    await requireDependencies();
    // Check both ports before starting either app. Unknown servers stay untouched.
    const statuses = await Promise.all(apps.map(inspectVisualServer));
    for (const status of statuses)
      if (status.state === "occupied")
        throw new Error(
          `${status.url} is in use. ${status.reason} No existing server was stopped. Use the expected visual app on this port, then run the launcher again.`,
        );
    for (const [index, app] of apps.entries()) {
      if (stopping) break;
      const status = statuses[index];
      if (status.state === "matching") {
        console.log(`[visual:dev] Reuse ${app.framework}: ${status.url}`);
        continue;
      }
      const child = spawn(
        process.execPath,
        [
          vite,
          "--config",
          "vite.config.ts",
          "--host",
          "127.0.0.1",
          "--port",
          String(app.port),
          "--strictPort",
        ],
        {
          cwd: resolve(import.meta.dirname, "apps", app.directory),
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      owned.add(child);
      let log = "";
      let spawnError;
      for (const stream of [child.stdout, child.stderr])
        stream.on("data", (chunk) => {
          log = `${log}${chunk}`.slice(-12000);
          process.stdout.write(`[${app.framework}] ${chunk}`);
        });
      child.on("error", (error) => {
        spawnError = error;
      });
      child.on("exit", (code, signal) => {
        if (!stopping && keepAlive) {
          console.error(
            `[visual:dev] The ${app.framework} server stopped (${signal ?? code}).`,
          );
          void shutdown(1);
        }
      });
      const deadline = Date.now() + 30000;
      let ready = false;
      while (!stopping && Date.now() < deadline) {
        if (spawnError) throw spawnError;
        if (child.exitCode !== null || child.signalCode !== null)
          throw new Error(
            `The ${app.framework} visual server stopped before it was ready.\n${log}`,
          );
        const current = await inspectVisualServer(app);
        if (current.state === "matching") {
          ready = true;
          break;
        }
        await pause(150);
      }
      if (stopping) break;
      if (!ready)
        throw new Error(
          `The ${app.framework} visual server did not become ready in 30 seconds. Check its output and dependencies.\n${log}`,
        );
      console.log(`[visual:dev] Started ${app.framework}: ${status.url}`);
    }
    if (!stopping) {
      for (const child of owned)
        if (child.exitCode !== null || child.signalCode !== null)
          throw new Error(
            "A visual server stopped during startup. Check the server output above.",
          );
      console.log(`\nGallery: ${gallery}`);
      console.log(
        "The gallery uses the root preview server on port 5173. If it is not running, run `npm run dev` in a separate terminal.",
      );
      console.log(
        "Press Ctrl+C to stop this launcher. Only servers started by this launcher will stop; reused servers will remain running.",
      );
      // Signal handlers alone do not keep Node alive when both apps were reused.
      keepAlive = setInterval(() => {}, 60000);
      await finished;
    }
  } catch (error) {
    console.error(`[visual:dev] ${error.message}`);
    await shutdown(1);
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await runVisualDev();
