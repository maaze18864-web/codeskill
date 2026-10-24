// Explicit integration test: creates and deletes test projects on the supplied API.
import assert from "node:assert/strict";
import http from "node:http";
import { gunzipSync } from "node:zlib";
const api = process.env.PROJECT_TEST_API || "http://127.0.0.1:5001/api";
if (!process.env.PROJECT_TEST_EMAIL || !process.env.PROJECT_TEST_PASSWORD)
  throw Error(
    "Set PROJECT_TEST_EMAIL and PROJECT_TEST_PASSWORD for a disposable test user",
  );
const json = async (path, method = "GET", payload, token) => {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(`${method} ${path}: ${response.status} ${data.message}`);
  return data;
};
const login = await json("/auth/login", "POST", {
  email: process.env.PROJECT_TEST_EMAIL,
  password: process.env.PROJECT_TEST_PASSWORD,
});
const token = login.token;
assert.ok(token);
// Production-style wildcard localhost hosts need an explicit Node DNS override.
// Local previews use plain localhost and must work without this override.
async function previewFetch(address, options = {}) {
  const url = new URL(address);
  if (!url.hostname.endsWith(".localhost") || url.protocol !== "http:")
    return fetch(address, options);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: {
          ...options.headers,
          Host: url.host,
          "accept-encoding": "gzip",
        },
        timeout: 65000,
      },
      (response) => {
        const chunks = [];
        response.on("data", (c) => chunks.push(c));
        response.on("error", reject);
        response.on("end", () => {
          const raw = Buffer.concat(chunks);
          const data =
            response.headers["content-encoding"] === "gzip"
              ? gunzipSync(raw)
              : raw;
          resolve(
            new Response(response.statusCode === 204 ? null : data, {
              status: response.statusCode,
              headers: Object.fromEntries(
                Object.entries(response.headers)
                  .filter(([, v]) => v !== undefined)
                  .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v]),
              ),
            }),
          );
        });
      },
    );
    request.on("timeout", () =>
      request.destroy(Error("Preview request timed out")),
    );
    request.on("error", reject);
    request.end(options.body);
  });
}

const stacks = [
  ["html", null],
  ["react", null],
  ["vue", null],
  ["svelte", null],
  ["nextjs", null],
  [null, "express"],
  [null, "fastify"],
  [null, "flask"],
  [null, "fastapi"],
  [null, "springboot"],
  ["react", "fastapi"],
  ["react", "springboot"],
  ["vue", "flask"],
  ["nextjs", "springboot"],
];
let count = 0;
for (const [frontendStack, backendStack] of stacks) {
  const { project } = await json(
    "/projects",
    "POST",
    {
      name: `Runtime smoke ${frontendStack || ""} ${backendStack || ""}`,
      mode:
        frontendStack && backendStack
          ? "fullstack"
          : frontendStack
            ? "frontend"
            : "backend",
      ...(frontendStack ? { frontendStack } : {}),
      ...(backendStack ? { backendStack } : {}),
    },
    token,
  );
  try {
    const runtime = await json(
      `/projects/${project.id}/runtime`,
      "POST",
      undefined,
      token,
    );
    assert.equal(runtime.state, "ready");
    if (frontendStack) {
      const response = await previewFetch(runtime.previewUrl);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /<html(?:\s|>)/i);
      assert.match(
        response.headers.get("content-security-policy"),
        /sandbox allow-scripts/,
      );
      if (backendStack) {
        const r = await previewFetch(runtime.previewUrl + "api/hello");
        assert.equal(r.status, 200);
        assert.equal((await r.json()).stack, backendStack);
        const health = await previewFetch(
          runtime.previewUrl + "__backend/health",
        );
        assert.equal(health.status, 200);
        const preflight = await previewFetch(runtime.previewUrl + "api/echo", {
          method: "OPTIONS",
          headers: {
            Origin: new URL(runtime.previewUrl).origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type, Authorization",
          },
        });
        assert.equal(preflight.status, 204);
        assert.equal(
          preflight.headers.get("access-control-allow-origin"),
          new URL(runtime.previewUrl).origin,
        );
        const post = await previewFetch(runtime.previewUrl + "api/echo", {
          method: "POST",
          headers: {
            Origin: new URL(runtime.previewUrl).origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ preview: true }),
        });
        assert.deepEqual((await post.json()).received, { preview: true });
      }
    }
    if (backendStack || frontendStack === "nextjs") {
      const r = await json(
        `/projects/${project.id}/request`,
        "POST",
        { method: "GET", path: "/api/hello" },
        token,
      );
      assert.equal(r.status, 200);
      assert.equal(JSON.parse(r.body).stack, backendStack || "nextjs");
      const echo = await json(
        `/projects/${project.id}/request`,
        "POST",
        {
          method: "POST",
          path: "/api/echo",
          headers: '{"Content-Type":"application/json"}',
          body: '{"smoke":true}',
        },
        token,
      );
      assert.deepEqual(JSON.parse(echo.body).received, { smoke: true });
    }
    const isolation = await json(
      `/projects/${project.id}/command`,
      "POST",
      {
        command:
          "node -e \"const fs=require('fs');const n=require('os').networkInterfaces();console.log(JSON.stringify({uid:process.getuid(),interfaces:Object.keys(n),docker:fs.existsSync('/var/run/docker.sock'),secrets:!!process.env.PROJECT_RUNNER_TOKEN,aws:!!process.env.AWS_ACCESS_KEY_ID}))\"",
      },
      token,
    );
    assert.match(isolation.output, /"uid":1000/);
    assert.match(isolation.output, /"interfaces":\["lo"\]/);
    assert.match(isolation.output, /"docker":false/);
    assert.match(isolation.output, /"secrets":false/);
    assert.match(isolation.output, /"aws":false/);
    const stoppedUrl = runtime.previewUrl;
    await json(`/projects/${project.id}/runtime`, "DELETE", undefined, token);
    assert.equal(
      (await json(`/projects/${project.id}`, "GET", undefined, token)).project
        .files.length,
      project.files.length,
    );
    if (stoppedUrl) {
      try {
        assert.equal((await previewFetch(stoppedUrl)).status, 404);
      } catch (error) {
        // Local per-runtime listeners close on stop; a shared production gateway
        // stays up and returns 404 for a revoked capability instead.
        if (error.code !== "ECONNREFUSED" && error.cause?.code !== "ECONNREFUSED")
          throw error;
      }
    }
    console.log(
      `PASS ${frontendStack || "—"} + ${backendStack || "—"}: startup, HTTP, isolation, cleanup, persistence`,
    );
    count++;
  } finally {
    await json(`/projects/${project.id}`, "DELETE", undefined, token);
  }
}
console.log(`All ${count} runtime configurations passed.`);
