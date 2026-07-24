export function stripBasePath(path: string, basePath: string) {
  return path.replace(`${basePath}/`, "");
}
