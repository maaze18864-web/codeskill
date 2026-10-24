import type { ProjectFile } from '../database/entities/project-workspace.entity';

const springPom =
  '<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">\n  <modelVersion>4.0.0</modelVersion>\n  <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>4.1.2</version><relativePath/></parent>\n  <groupId>com.codeskill</groupId><artifactId>project</artifactId><version>0.0.1</version>\n  <properties><java.version>17</java.version></properties>\n  <dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-webmvc</artifactId></dependency></dependencies>\n  <build><finalName>project</finalName><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>\n</project>\n';
const springApplication =
  'package com.codeskill.project;\n\nimport java.util.Map;\nimport org.springframework.boot.SpringApplication;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\nimport org.springframework.web.bind.annotation.*;\n\n@SpringBootApplication\n@RestController\npublic class Application {\n    public static void main(String[] args) { SpringApplication.run(Application.class, args); }\n    @GetMapping("/api/hello")\n    public Map<String, String> hello() { return Map.of("message", "Hello from Spring Boot!", "stack", "springboot"); }\n    @PostMapping("/api/echo")\n    public Map<String, Object> echo(@RequestBody Map<String, Object> body) { return Map.of("received", body); }\n    @GetMapping("/health")\n    public Map<String, String> health() { return Map.of("status", "ok"); }\n}\n';
const springProperties =
  'server.address=127.0.0.1\nserver.port=3001\nserver.tomcat.threads.max=8\nserver.tomcat.threads.min-spare=1\nspring.main.banner-mode=off\nlogging.level.root=WARN\n';

export function springProjectFiles(): ProjectFile[] {
  return [
    { path: 'backend/pom.xml', content: springPom },
    {
      path: 'backend/src/main/java/com/codeskill/project/Application.java',
      content: springApplication,
    },
    {
      path: 'backend/src/main/resources/application.properties',
      content: springProperties,
    },
  ];
}
export function nextProjectFiles(hasBackend: boolean): ProjectFile[] {
  return [
    {
      path: 'frontend/package.json',
      content: JSON.stringify(
        {
          name: 'my-next-project',
          private: true,
          scripts: {
            dev: 'next dev --webpack --hostname 127.0.0.1 --port 4173',
          },
          dependencies: {
            next: '16.4.2',
            react: '19.2.4',
            'react-dom': '19.2.4',
          },
        },
        null,
        2,
      ),
    },
    {
      path: 'frontend/next.config.mjs',
      content: String.raw`const basePath = (process.env.PROJECT_PREVIEW_BASE || '').replace(/\/$/, '');
export default { basePath, devIndicators: false, experimental: { cpus: 1, webpackMemoryOptimizations: true }, env: { NEXT_PUBLIC_PROJECT_BASE: basePath } };
`,
    },
    {
      path: 'frontend/app/layout.js',
      content: `import './globals.css';
export const metadata = { title: 'My Next.js project' };
export default function Layout({children}) { return <html lang="en"><body>{children}</body></html>; }
`,
    },
    {
      path: 'frontend/app/page.js',
      content: `'use client';
import { useState } from 'react';
export default function Home() {
  const [message, setMessage] = useState('Your Next.js workspace is ready.');
  async function test() { const data = await fetch((process.env.NEXT_PUBLIC_PROJECT_BASE || '') + '/api/hello').then(r => r.json()); setMessage(data.message); }
  return <main><p className="eyebrow">CODESKILL PROJECTS</p><h1>Build with Next.js.</h1><p>{message}</p><button onClick={test}>${hasBackend ? 'Call my API' : 'Test server route'}</button></main>;
}
`,
    },
    {
      path: 'frontend/app/globals.css',
      content: `* { box-sizing: border-box; } body { margin:0; color:#172033; background:#f5f7fb; font:16px/1.6 system-ui,sans-serif; } main { max-width:700px; margin:12vh auto; padding:40px; background:white; border:1px solid #e2e8f0; border-radius:18px; } h1 { font-size:36px; letter-spacing:-1px; line-height:1.2; } .eyebrow { color:#c2373b; font-weight:700; font-size:12px; letter-spacing:2px; } button { background:#c2373b; color:white; padding:12px 20px; border:0; border-radius:8px; cursor:pointer; font:inherit; }
`,
    },
    {
      path: 'frontend/app/api/hello/route.js',
      content: `export async function GET() { return Response.json({ message: 'Hello from Next.js!', stack: 'nextjs' }); }
`,
    },
    {
      path: 'frontend/app/api/echo/route.js',
      content: `export async function POST(request) { return Response.json({ received: await request.json() }); }
`,
    },
  ];
}
