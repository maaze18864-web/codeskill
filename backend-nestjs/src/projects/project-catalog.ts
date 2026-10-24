import { BadRequestException } from '@nestjs/common';
import type { ProjectFile } from '../database/entities/project-workspace.entity';
import type { CreateProjectDto } from './projects.dto';
import {
  nextProjectFiles,
  springProjectFiles,
} from './extended-project-templates';

export const projectCatalog = {
  frontend: [
    {
      id: 'nextjs',
      name: 'Next.js',
      description: 'React pages, server rendering, and API routes.',
    },
    {
      id: 'html',
      name: 'HTML / CSS / JavaScript',
      description: 'A lightweight website with vanilla JavaScript.',
    },
    {
      id: 'react',
      name: 'React',
      description: 'Components and hooks, powered by Vite.',
    },
    {
      id: 'vue',
      name: 'Vue',
      description: 'Vue single-file components with Vite.',
    },
    {
      id: 'svelte',
      name: 'Svelte',
      description: 'Svelte components with Vite.',
    },
  ],
  backend: [
    {
      id: 'springboot',
      name: 'Java Spring Boot',
      description: 'Java 17 REST APIs with Spring Boot and Maven.',
    },
    { id: 'express', name: 'Express', description: 'Node.js REST API.' },
    {
      id: 'fastify',
      name: 'Fastify',
      description: 'A fast Node.js API with schema support.',
    },
    { id: 'flask', name: 'Flask', description: 'A compact Python web API.' },
    {
      id: 'fastapi',
      name: 'FastAPI',
      description: 'Python APIs with type validation and OpenAPI.',
    },
  ],
  limits: { maxFiles: 100, maxBytes: 2000000, idleMinutes: 20, maxMinutes: 60 },
};

export function validateProjectFiles(files: ProjectFile[]): ProjectFile[] {
  if (!Array.isArray(files) || !files.length || files.length > 100)
    throw new BadRequestException('Use 1–100 files.');
  const seen = new Set<string>();
  let bytes = 0;
  for (const file of files) {
    if (
      typeof file?.path !== 'string' ||
      typeof file.content !== 'string' ||
      !/^[a-zA-Z0-9_.@()\- /]+$/.test(file.path) ||
      file.path.length > 160 ||
      file.path.startsWith('/') ||
      file.path
        .split('/')
        .some(
          (part) =>
            !part ||
            ['.', '..', 'node_modules', '.git', '__pycache__'].includes(part),
        ) ||
      seen.has(file.path)
    )
      throw new BadRequestException(
        'File paths must be unique, relative paths without traversal or generated directories.',
      );
    seen.add(file.path);
    const size = Buffer.byteLength(file.content, 'utf8');
    bytes += size;
    if (size > 200000 || bytes > 2000000)
      throw new BadRequestException(
        'Files are limited to 200 KB each and 2 MB per project.',
      );
  }
  for (const path of seen)
    if ([...seen].some((other) => other.startsWith(`${path}/`)))
      throw new BadRequestException('A file cannot also be a folder.');
  return files.map(({ path, content }) => ({ path, content }));
}

export function validateProjectDirectories(
  directories: string[],
  files: ProjectFile[],
): string[] {
  if (!Array.isArray(directories) || directories.length > 500)
    throw new BadRequestException('Use at most 500 folders.');
  const result = new Set<string>();
  for (const directory of directories) {
    if (
      typeof directory !== 'string' ||
      !directory ||
      directory.length > 160 ||
      directory.startsWith('/') ||
      !/^[a-zA-Z0-9_.@()\- /]+$/.test(directory) ||
      directory
        .split('/')
        .some(
          (part) =>
            !part ||
            ['.', '..', 'node_modules', '.git', '__pycache__'].includes(part),
        ) ||
      files.some(
        (file) =>
          file.path === directory || directory.startsWith(file.path + '/'),
      )
    )
      throw new BadRequestException(
        'Folders must use safe relative paths and cannot conflict with files.',
      );
    result.add(directory);
  }
  return [...result].sort();
}

export function createProjectTemplate(dto: CreateProjectDto) {
  const frontendStack = dto.mode === 'backend' ? null : dto.frontendStack;
  const backendStack = dto.mode === 'frontend' ? null : dto.backendStack;
  if (
    !dto.name.trim() ||
    (dto.mode !== 'backend' &&
      !projectCatalog.frontend.some((s) => s.id === frontendStack)) ||
    (dto.mode !== 'frontend' &&
      !projectCatalog.backend.some((s) => s.id === backendStack))
  )
    throw new BadRequestException(
      'Select a supported stack for each part of the project.',
    );
  const files: ProjectFile[] = [];
  const add = (path: string, content: string) => files.push({ path, content });
  add(
    'README.md',
    `# ${dto.name.trim()}\n\nEdit files, save, and choose Run project.\n\n${frontendStack ? 'Frontend: frontend/ (Vite on port 4173).\n' : ''}${backendStack ? 'Backend: backend/ (port 3001). Try GET /api/hello in the API client.\n' : ''}\nDependencies are preinstalled for your selected stack. Runtime networking is isolated; internet package installation is unavailable. Files saved in CodeSkill survive a stopped or expired runtime. Terminal-only changes are temporary; use the editor to save durable files.\n`,
  );
  if (frontendStack === 'nextjs')
    files.push(...nextProjectFiles(Boolean(backendStack)));
  else if (frontendStack) {
    const pkg: Record<string, string> = { vite: '6.4.5' };
    if (frontendStack === 'react')
      Object.assign(pkg, { react: '19.2.4', 'react-dom': '19.2.4' });
    if (frontendStack === 'vue')
      Object.assign(pkg, { vue: '3.5.44', '@vitejs/plugin-vue': '5.2.4' });
    if (frontendStack === 'svelte')
      Object.assign(pkg, {
        svelte: '5.57.2',
        '@sveltejs/vite-plugin-svelte': '5.1.1',
      });
    add(
      'frontend/package.json',
      JSON.stringify(
        {
          name: 'my-frontend',
          private: true,
          type: 'module',
          scripts: { dev: 'vite --host 127.0.0.1 --port 4173 --strictPort' },
          dependencies: pkg,
        },
        null,
        2,
      ),
    );
    add(
      'frontend/index.html',
      '<!doctype html>\n<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>My CodeSkill project</title></head>\n<body><div id="app"></div><script type="module" src="/src/main.' +
        (frontendStack === 'react' ? 'jsx' : 'js') +
        '"></script></body></html>\n',
    );
    const configImport =
      frontendStack === 'vue'
        ? "import vue from '@vitejs/plugin-vue';\n"
        : frontendStack === 'svelte'
          ? "import { svelte } from '@sveltejs/vite-plugin-svelte';\n"
          : '';
    add(
      'frontend/vite.config.js',
      `import { defineConfig } from 'vite';\n${configImport}export default defineConfig({\n  base: process.env.PROJECT_PREVIEW_BASE || '/',\n  plugins: [${frontendStack === 'vue' ? 'vue()' : frontendStack === 'svelte' ? 'svelte()' : ''}],\n  server: { host: '127.0.0.1', port: 4173, strictPort: true, hmr: false, allowedHosts: ['localhost', '127.0.0.1'], cors: { origin: 'null' } }\n});\n`,
    );
    add(
      'frontend/src/style.css',
      '* { box-sizing: border-box; }\nbody { margin: 0; color: #172033; background: #f5f7fb; font: 16px/1.6 system-ui, sans-serif; }\nmain { max-width: 700px; margin: 12vh auto; padding: 40px; background: white; border: 1px solid #e2e8f0; border-radius: 18px; }\nh1 { font-size: 36px; letter-spacing: -1px; line-height: 1.2; }\n.eyebrow { color: #c2373b; font-weight: 700; font-size: 12px; letter-spacing: 2px; }\nbutton { background: #c2373b; color: white; padding: 12px 20px; border: 0; border-radius: 8px; cursor: pointer; font: inherit; }\npre { white-space: pre-wrap; }\n',
    );
    const request = backendStack
      ? 'const data = await fetch(`${import.meta.env.BASE_URL}api/hello`).then(r => r.json());'
      : "const data = { message: 'Your frontend is running. Make it your own.' };";
    if (frontendStack === 'react')
      add(
        'frontend/src/main.jsx',
        `import React, { useState } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './style.css';\nfunction App() {\n  const [message, setMessage] = useState('Your workspace is ready.');\n  async function test() { ${request} setMessage(data.message); }\n  return <main><p className="eyebrow">CODESKILL PROJECTS</p><h1>Build something worth sharing.</h1><p>{message}</p><button onClick={test}>${backendStack ? 'Call my API' : 'Try it'}</button></main>;\n}\ncreateRoot(document.getElementById('app')).render(<App />);\n`,
      );
    else if (frontendStack === 'vue') {
      add(
        'frontend/src/main.js',
        "import { createApp } from 'vue';\nimport App from './App.vue';\nimport './style.css';\ncreateApp(App).mount('#app');\n",
      );
      add(
        'frontend/src/App.vue',
        `<script setup>\nimport { ref } from 'vue';\nconst message = ref('Your workspace is ready.');\nasync function test() { ${request} message.value = data.message; }\n</script>\n<template><main><p class="eyebrow">CODESKILL PROJECTS</p><h1>Build something worth sharing.</h1><p>{{ message }}</p><button @click="test">${backendStack ? 'Call my API' : 'Try it'}</button></main></template>\n`,
      );
    } else if (frontendStack === 'svelte') {
      add(
        'frontend/src/main.js',
        "import { mount } from 'svelte';\nimport App from './App.svelte';\nimport './style.css';\nmount(App, { target: document.getElementById('app') });\n",
      );
      add(
        'frontend/src/App.svelte',
        `<script>\nlet message = $state('Your workspace is ready.');\nasync function test() { ${request} message = data.message; }\n</script>\n<main><p class="eyebrow">CODESKILL PROJECTS</p><h1>Build something worth sharing.</h1><p>{message}</p><button onclick={test}>${backendStack ? 'Call my API' : 'Try it'}</button></main>\n`,
      );
    } else
      add(
        'frontend/src/main.js',
        `import './style.css';\ndocument.querySelector('#app').innerHTML = '<main><p class="eyebrow">CODESKILL PROJECTS</p><h1>Build something worth sharing.</h1><p id="message">Your workspace is ready.</p><button>Try it</button></main>';\ndocument.querySelector('button').addEventListener('click', async () => { ${request} document.querySelector('#message').textContent = data.message; });\n`,
      );
  }
  if (backendStack === 'springboot') files.push(...springProjectFiles());
  else if (backendStack === 'express' || backendStack === 'fastify') {
    add(
      'backend/package.json',
      JSON.stringify(
        {
          name: 'my-api',
          private: true,
          type: 'module',
          scripts: { dev: 'node --watch server.js' },
          dependencies: {
            [backendStack]: backendStack === 'express' ? '5.1.0' : '5.12.7',
          },
        },
        null,
        2,
      ),
    );
    add(
      'backend/server.js',
      backendStack === 'express'
        ? "import express from 'express';\nconst app = express();\napp.use(express.json());\napp.get('/api/hello', (_req, res) => res.json({ message: 'Hello from Express!', stack: 'express' }));\napp.post('/api/echo', (req, res) => res.json({ received: req.body }));\napp.get('/health', (_req, res) => res.json({ status: 'ok' }));\napp.listen(3001, '127.0.0.1', () => console.log('API ready on :3001'));\n"
        : "import Fastify from 'fastify';\nconst app = Fastify({ logger: true });\napp.get('/api/hello', async () => ({ message: 'Hello from Fastify!', stack: 'fastify' }));\napp.post('/api/echo', async req => ({ received: req.body }));\napp.get('/health', async () => ({ status: 'ok' }));\nawait app.listen({ port: 3001, host: '127.0.0.1' });\n",
    );
  } else if (backendStack === 'flask') {
    add('backend/requirements.txt', 'Flask==3.1.3\n');
    add(
      'backend/main.py',
      "from flask import Flask, jsonify, request\napp = Flask(__name__)\n\n@app.get('/api/hello')\ndef hello():\n    return jsonify(message='Hello from Flask!', stack='flask')\n\n@app.post('/api/echo')\ndef echo():\n    return jsonify(received=request.get_json(silent=True))\n\n@app.get('/health')\ndef health():\n    return jsonify(status='ok')\n",
    );
  } else if (backendStack === 'fastapi') {
    add('backend/requirements.txt', 'fastapi==0.161.1\nuvicorn==0.54.0\n');
    add(
      'backend/main.py',
      "from fastapi import FastAPI, Request\napp = FastAPI()\n\n@app.get('/api/hello')\nasync def hello():\n    return {'message': 'Hello from FastAPI!', 'stack': 'fastapi'}\n\n@app.post('/api/echo')\nasync def echo(request: Request):\n    return {'received': await request.json()}\n\n@app.get('/health')\nasync def health():\n    return {'status': 'ok'}\n",
    );
  }
  return {
    name: dto.name.trim(),
    mode: dto.mode,
    frontendStack: frontendStack || null,
    backendStack: backendStack || null,
    files: validateProjectFiles(files),
  };
}
