import { zipSync, type Zippable } from "fflate";
import { validProjectPath, type ProjectFile } from "./project-workspace";

export function createProjectZip(
  name: string,
  files: ProjectFile[],
  directories: string[] = [],
) {
  const folder =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "project";
  // A null-prototype map also permits ordinary filenames such as constructor.
  const entries: Zippable = Object.create(null);
  const encoder = new TextEncoder();
  const folders = new Set<string>([""]);
  for (const directory of directories) {
    if (!validProjectPath(directory, []))
      throw new Error("The project contains an invalid folder path.");
    if (
      files.some(
        (file) =>
          file.path === directory || directory.startsWith(file.path + "/"),
      )
    )
      continue;
    folders.add(directory);
  }
  for (const file of files) {
    if (!validProjectPath(file.path, files, file.path))
      throw new Error("The project contains an invalid file path.");
    const parts = file.path.split("/");
    for (let n = 1; n < parts.length; n++)
      folders.add(parts.slice(0, n).join("/"));
    entries[`${folder}/${file.path}`] = encoder.encode(file.content);
  }
  for (const directory of folders)
    entries[`${folder}/${directory ? directory + "/" : ""}`] = new Uint8Array(
      0,
    );
  const bytes = zipSync(entries, { level: 6 });
  return { bytes, filename: `${folder}.zip` };
}
