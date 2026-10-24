declare module "prettier-plugin-svelte/browser" {
  export const parsers: import("prettier").Plugin["parsers"];
  export const printers: import("prettier").Plugin["printers"];
  export const languages: import("prettier").Plugin["languages"];
  export const options: import("prettier").Plugin["options"];
}
