import path from "path";
import fs from "fs";

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

let Parser: any = null;
let initialized = false;

const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".java": "java",
  ".go": "go",
  ".rs": "rust",
};

const WASM_DIR = path.join(process.cwd(), "public", "tree-sitter");

const languageCache = new Map<string, any>();

async function ensureInitialized() {
  if (!initialized) {
    Parser = require("web-tree-sitter");
    // Handle both default export and module.exports
    if (Parser.default) Parser = Parser.default;
    const wasmPath = path.join(WASM_DIR, "web-tree-sitter.wasm");
    await Parser.init({
      locateFile: () => wasmPath,
    });
    initialized = true;
  }
}

function getWasmPath(language: string): string {
  const wasmFile = `tree-sitter-${language}.wasm`;
  return path.join(WASM_DIR, wasmFile);
}

export function getLanguageForFile(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] || null;
}

export function getSupportedExtensions(): string[] {
  return Object.keys(LANGUAGE_MAP);
}

async function loadLanguage(languageName: string): Promise<any | null> {
  if (languageCache.has(languageName)) {
    return languageCache.get(languageName)!;
  }

  const wasmPath = getWasmPath(languageName);
  if (!fs.existsSync(wasmPath)) {
    console.warn(`Tree-sitter WASM not found: ${wasmPath}`);
    return null;
  }

  const language = await Parser.Language.load(wasmPath);
  languageCache.set(languageName, language);
  return language;
}

export interface ParsedFunction {
  name: string;
  code: string;
  startLine: number;
  endLine: number;
}

export interface ParsedModule {
  name: string;
  type: "class" | "interface" | "enum" | "export";
  startLine: number;
  endLine: number;
  functions: ParsedFunction[];
}

export interface ParseResult {
  modules: ParsedModule[];
  functions: ParsedFunction[];
  imports: string[];
}

const FUNCTION_TYPES = new Set([
  "function_declaration",
  "method_definition",
  "function_definition",
  "method_declaration",
  "function_item",
  "func_declaration",
  "arrow_function",
  "function",
]);

const CLASS_TYPES = new Set([
  "class_declaration",
  "class_definition",
  "interface_declaration",
  "enum_declaration",
  "type_alias_declaration",
  "struct_item",
  "impl_item",
]);

const IMPORT_TYPES = new Set([
  "import_statement",
  "import_declaration",
  "use_declaration",
]);

function extractName(node: any): string {
  for (const child of node.children) {
    if (
      child.type === "identifier" ||
      child.type === "type_identifier" ||
      child.type === "property_identifier"
    ) {
      return child.text;
    }
    if (child.type === "name") {
      return child.text;
    }
  }
  if (
    node.type === "arrow_function" &&
    node.parent?.type === "variable_declarator"
  ) {
    const nameNode = node.parent.childForFieldName("name");
    if (nameNode) return nameNode.text;
  }
  return "<anonymous>";
}

function extractImportPath(node: any): string {
  const stringNode = node.descendantsOfType("string");
  if (stringNode.length > 0) {
    return stringNode[0].text.replace(/['"]/g, "");
  }
  return node.text;
}

export async function parseFile(
  content: string,
  filePath: string
): Promise<ParseResult | null> {
  const language = getLanguageForFile(filePath);
  if (!language) return null;

  await ensureInitialized();

  const lang = await loadLanguage(language);
  if (!lang) return null;

  const parser = new Parser();
  parser.setLanguage(lang);

  const tree = parser.parse(content);
  const root = tree.rootNode;

  const modules: ParsedModule[] = [];
  const functions: ParsedFunction[] = [];
  const imports: string[] = [];

  function visit(node: any, parentModule?: ParsedModule) {
    if (IMPORT_TYPES.has(node.type)) {
      imports.push(extractImportPath(node));
      return;
    }

    if (CLASS_TYPES.has(node.type)) {
      const mod: ParsedModule = {
        name: extractName(node),
        type: node.type.includes("interface")
          ? "interface"
          : node.type.includes("enum")
            ? "enum"
            : "class",
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        functions: [],
      };

      for (const child of node.children) {
        if (child.type === "class_body" || child.type === "block") {
          for (const member of child.children) {
            if (FUNCTION_TYPES.has(member.type)) {
              mod.functions.push({
                name: extractName(member),
                code: member.text,
                startLine: member.startPosition.row + 1,
                endLine: member.endPosition.row + 1,
              });
            }
          }
        }
      }

      modules.push(mod);
      return;
    }

    if (FUNCTION_TYPES.has(node.type) && !parentModule) {
      if (node.type === "arrow_function") {
        functions.push({
          name: extractName(node),
          code: node.parent?.type === "variable_declarator"
            ? (node.parent.parent?.text ?? node.text)
            : node.text,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        });
        return;
      }

      functions.push({
        name: extractName(node),
        code: node.text,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
      });
      return;
    }

    if (
      node.type === "lexical_declaration" ||
      node.type === "export_statement"
    ) {
      for (const child of node.children) {
        visit(child, parentModule);
      }
      return;
    }

    if (node.type === "variable_declarator") {
      const init = node.childForFieldName("value") ?? node.children.find((c: any) => c.type === "arrow_function");
      if (init && FUNCTION_TYPES.has(init.type)) {
        visit(init, parentModule);
        return;
      }
    }

    for (const child of node.children) {
      visit(child, parentModule);
    }
  }

  visit(root);
  parser.delete();

  return { modules, functions, imports };
}
