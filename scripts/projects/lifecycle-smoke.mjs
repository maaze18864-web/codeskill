import assert from "node:assert/strict";
const api = process.env.PROJECT_TEST_API || "http://127.0.0.1:5001/api";
if (!process.env.PROJECT_TEST_EMAIL || !process.env.PROJECT_TEST_PASSWORD)
  throw Error("Set disposable test user credentials");
const login = await fetch(api + "/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: process.env.PROJECT_TEST_EMAIL,
    password: process.env.PROJECT_TEST_PASSWORD,
  }),
});
const { token } = await login.json();
assert.ok(token);
async function call(path, method = "GET", body) {
  const r = await fetch(api + path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
const projects = [];
try {
  for (let n = 0; n < 2; n++) {
    const r = await call("/projects", "POST", {
      name: "Lifecycle smoke " + n,
      mode: "backend",
      backendStack: "flask",
    });
    assert.equal(r.status, 201);
    projects.push(r.data.project);
  }
  const starts = await Promise.all(
    projects.map((p) => call(`/projects/${p.id}/runtime`, "POST")),
  );
  assert.equal(starts.filter((x) => x.status === 201).length, 1);
  assert.equal(starts.filter((x) => x.status === 409).length, 1);
  const index = starts.findIndex((x) => x.status === 201),
    p = projects[index];
  const files = p.files.map((f) => ({
    ...f,
    content:
      f.path === "backend/main.py"
        ? f.content.replace("Hello from Flask!", "Saved edit is live!")
        : f.content,
  }));
  const saved = await call(`/projects/${p.id}`, "PUT", {
    revision: p.revision,
    files,
  });
  assert.equal(saved.status, 200);
  const stale = await call(`/projects/${p.id}`, "PUT", {
    revision: p.revision,
    files: p.files,
  });
  assert.equal(stale.status, 409);
  const sync = await call(`/projects/${p.id}/runtime/files`, "PUT");
  assert.equal(sync.status, 200);
  const response = await call(`/projects/${p.id}/request`, "POST", {
    method: "GET",
    path: "/api/hello",
  });
  assert.equal(JSON.parse(response.data.body).message, "Saved edit is live!");
  const python = await call(`/projects/${p.id}/command`, "POST", {
    command: "python --version && node --version",
  });
  assert.equal(python.data.exitCode, 0);
  assert.match(python.data.output, /Python 3/);
  const network = await call(`/projects/${p.id}/command`, "POST", {
    command: `node -e "fetch('http://169.254.169.254/latest/meta-data/',{signal:AbortSignal.timeout(500)}).then(()=>{console.log('UNEXPECTED NETWORK');process.exitCode=1}).catch(()=>console.log('Metadata unreachable'))"`,
  });
  assert.equal(network.data.exitCode, 0);
  assert.match(network.data.output, /Metadata unreachable/);
  const timeout = await call(`/projects/${p.id}/command`, "POST", {
    command: "sleep 30",
  });
  assert.equal(timeout.data.timedOut, true);
  await call(`/projects/${p.id}/runtime`, "DELETE");
  const retained = await call(`/projects/${p.id}`);
  assert.equal(retained.data.project.revision, saved.data.project.revision);
  assert.deepEqual(retained.data.project.files, files);
  console.log(
    "PASS concurrent admission, stale revisions, save/sync, Python terminal, metadata isolation, command timeout, and durable files.",
  );
} finally {
  for (const p of projects) await call(`/projects/${p.id}`, "DELETE");
}
