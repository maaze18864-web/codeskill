import { validProjectPath, type ProjectFile } from "./project-workspace";
export interface ProjectDocument {
  files: ProjectFile[];
  directories: string[];
}
export function projectDirectories(
  files: ProjectFile[],
  directories: string[] = [],
) {
  const all = new Set<string>();
  for (const directory of directories) {
    const parts = directory.split("/");
    for (let n = 1; n <= parts.length; n++)
      all.add(parts.slice(0, n).join("/"));
  }
  for (const file of files) {
    const parts = file.path.split("/");
    for (let n = 1; n < parts.length; n++) all.add(parts.slice(0, n).join("/"));
  }
  return [...all].sort();
}
export const projectSnapshot = (files: ProjectFile[], directories: string[]) =>
  JSON.stringify({
    files,
    directories: projectDirectories(files, directories),
  });
export const projectParent = (path: string) =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
export const remapProjectPath = (path: string, from: string, to: string) =>
  path === from
    ? to
    : path.startsWith(from + "/")
      ? to + path.slice(from.length)
      : path;

function validate(document: ProjectDocument) {
  if (!document.files.length || document.files.length > 100)
    throw Error("Keep 1–100 files in the project.");
  if (document.directories.length > 500)
    throw Error("Projects support up to 500 folders.");
  const paths = new Set<string>();
  for (const file of document.files) {
    if (
      paths.has(file.path) ||
      !validProjectPath(file.path, document.files, file.path)
    )
      throw Error(
        "A file or folder with that name already exists, or the path is invalid.",
      );
    paths.add(file.path);
  }
  for (const directory of document.directories)
    if (
      !validProjectPath(directory, []) ||
      document.files.some(
        (file) =>
          directory === file.path || directory.startsWith(file.path + "/"),
      )
    )
      throw Error("A folder cannot share a path with a file.");
  return document;
}
export function createProjectEntry(
  document: ProjectDocument,
  path: string,
  folder: boolean,
): ProjectDocument {
  const directories = projectDirectories(document.files, document.directories);
  if (!validProjectPath(path, document.files) || directories.includes(path))
    throw Error("Choose a unique, valid relative path.");
  return validate({
    files: folder ? document.files : [...document.files, { path, content: "" }],
    directories: projectDirectories(
      folder ? document.files : [...document.files, { path, content: "" }],
      folder ? [...directories, path] : directories,
    ),
  });
}
export function moveProjectEntry(
  document: ProjectDocument,
  from: string,
  to: string,
): ProjectDocument {
  const directories = projectDirectories(document.files, document.directories);
  const folder = directories.includes(from);
  if (!from || (!folder && !document.files.some((file) => file.path === from)))
    throw Error("Choose a file or folder to move.");
  if (from === to) return document;
  if (folder && to.startsWith(from + "/"))
    throw Error("A folder cannot be moved inside itself.");
  if (
    document.files.some((file) => file.path === to) ||
    directories.includes(to)
  )
    throw Error("A file or folder with that name already exists.");
  const files = document.files.map((file) => ({
    ...file,
    path: remapProjectPath(file.path, from, to),
  }));
  const nextDirectories = directories.map((path) =>
    remapProjectPath(path, from, to),
  );
  return validate({
    files,
    directories: projectDirectories(files, nextDirectories),
  });
}
export function deleteProjectEntry(
  document: ProjectDocument,
  path: string,
): ProjectDocument {
  if (!path) throw Error("The project root cannot be deleted here.");
  const files = document.files.filter(
    (file) => file.path !== path && !file.path.startsWith(path + "/"),
  );
  const directories = projectDirectories(
    document.files,
    document.directories,
  ).filter(
    (directory) => directory !== path && !directory.startsWith(path + "/"),
  );
  return validate({
    files,
    directories: projectDirectories(files, directories),
  });
}
export function mergeProjectDirectories(
  local: string[],
  base: string[],
  remote: string[],
  complete: boolean,
) {
  const result = new Set(local),
    before = new Set(base),
    incoming = new Set(remote);
  for (const path of new Set([...base, ...remote])) {
    if (!complete && !incoming.has(path)) continue;
    if (result.has(path) !== before.has(path)) continue;
    if (incoming.has(path)) result.add(path);
    else result.delete(path);
  }
  return [...result].sort();
}
