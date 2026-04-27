declare module "*.wasm" {
  const mod: WebAssembly.Module;
  export default mod;
}

declare module "*.ttf" {
  const data: ArrayBuffer;
  export default data;
}

declare module "*.otf" {
  const data: ArrayBuffer;
  export default data;
}
