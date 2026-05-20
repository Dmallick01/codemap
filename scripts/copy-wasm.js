const fs = require("fs");
const path = require("path");

const dest = path.join(__dirname, "../public/tree-sitter");
fs.mkdirSync(dest, { recursive: true });

// Copy web-tree-sitter WASM
const wtsSrc = path.join(__dirname, "../node_modules/web-tree-sitter/tree-sitter.wasm");
const wtsDest = path.join(dest, "web-tree-sitter.wasm");
if (fs.existsSync(wtsSrc)) {
  fs.copyFileSync(wtsSrc, wtsDest);
  console.log("Copied web-tree-sitter.wasm");
} else {
  console.warn("web-tree-sitter.wasm not found at", wtsSrc);
}

// Copy language WASMs from tree-sitter-wasms
const wasmSrc = path.join(__dirname, "../node_modules/tree-sitter-wasms/out");
const languages = ["typescript", "tsx", "javascript", "python", "java", "go", "rust"];
for (const lang of languages) {
  const src = path.join(wasmSrc, `tree-sitter-${lang}.wasm`);
  const dst = path.join(dest, `tree-sitter-${lang}.wasm`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`Copied tree-sitter-${lang}.wasm`);
  } else {
    console.warn(`tree-sitter-${lang}.wasm not found at`, src);
  }
}

console.log("WASM copy complete.");
