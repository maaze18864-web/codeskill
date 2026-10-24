"use client";
import Image from "next/image";
import { Check, Layers } from "lucide-react";
import type { Stack } from "@/lib/project-workspace";
const labels: Record<string, string> = {
  html: "HTML, CSS & JS",
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  nextjs: "Next.js",
  express: "Express",
  fastify: "Fastify",
  flask: "Flask",
  fastapi: "FastAPI",
  springboot: "Java Spring Boot",
};
export function TechnologyIcon({
  id,
  size = 28,
}: {
  id: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-black/5 bg-white p-1.5"
      aria-hidden="true"
    >
      <Image
        src={`/technology-icons/${id}.svg`}
        width={size}
        height={size}
        alt=""
        className="object-contain"
      />
    </span>
  );
}
export function TechnologyPicker({
  kind,
  stacks,
  value,
  onChange,
}: {
  kind: "frontend" | "backend";
  stacks: Stack[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 flex w-full items-center justify-between text-xs font-semibold">
        <span>
          {kind === "frontend" ? "Frontend framework" : "Backend framework"}
        </span>
        <span className="font-normal text-muted-foreground">Choose one</span>
      </legend>
      <div className="grid grid-cols-2 gap-2.5">
        {stacks.map((stack) => (
          <label key={stack.id} className="relative cursor-pointer">
            <input
              type="radio"
              name={`${kind}-technology`}
              value={stack.id}
              checked={value === stack.id}
              onChange={() => onChange(stack.id)}
              className="peer sr-only"
            />
            <div className="flex h-full min-h-24 items-start gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/35 hover:bg-muted/30 peer-checked:border-primary peer-checked:bg-primary/[0.04] peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
              <TechnologyIcon id={stack.id} size={24} />
              <div className="min-w-0 flex-1 pr-2">
                <span className="block text-xs font-semibold">
                  {labels[stack.id] || stack.name}
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
                  {stack.description}
                </span>
              </div>
              <span
                className={`absolute right-2 top-2 grid size-3 place-items-center rounded-full border ${value === stack.id ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
              >
                {value === stack.id && (
                  <Check className="size-2" strokeWidth={3} />
                )}
              </span>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function TechnologySummary({
  frontend,
  backend,
}: {
  frontend?: string;
  backend?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/25 px-4 py-3">
      <Layers className="size-4 text-muted-foreground" />
      <span className="mr-auto text-xs font-medium">Your workspace</span>
      <div className="flex items-center gap-2">
        {frontend && (
          <>
            <TechnologyIcon id={frontend} size={16} />
            <span className="text-xs font-semibold">{labels[frontend]}</span>
          </>
        )}
        {frontend && backend && (
          <span className="px-1 text-xs text-muted-foreground">+</span>
        )}
        {backend && (
          <>
            <TechnologyIcon id={backend} size={16} />
            <span className="text-xs font-semibold">{labels[backend]}</span>
          </>
        )}
      </div>
    </div>
  );
}
