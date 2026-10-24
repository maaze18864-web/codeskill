"use client";
import "@xterm/xterm/css/xterm.css";
import { useParams } from "next/navigation";
import { ProjectWorkbench } from "@/components/projects/ProjectWorkbench";
export default function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  return <ProjectWorkbench key={id} id={id} />;
}
