import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { parseBotConfig, type BotConfig } from "./schema";

function coerceEnvValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const trimmed = raw.trim();
    if (/^-?\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return raw;
  }
}

function envKeyToPath(key: string): string[] {
  return key
    .split("__")
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/_([a-z0-9])/g, (_, ch: string) => ch.toUpperCase()),
    );
}

function setPath(
  target: Record<string, unknown>,
  parts: string[],
  value: unknown,
): void {
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cursor[key];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

export function applyDealbotEnv(
  input: unknown,
  env: NodeJS.ProcessEnv,
): unknown {
  const root =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? structuredClone(input)
      : {};
  const obj = root as Record<string, unknown>;

  for (const [key, raw] of Object.entries(env)) {
    if (!key.startsWith("DEALBOT__") || raw === undefined) {
      continue;
    }
    const parts = envKeyToPath(key.slice("DEALBOT__".length));
    if (parts.length === 0 || parts.some((part) => part.length === 0)) {
      continue;
    }
    setPath(obj, parts, coerceEnvValue(raw));
  }

  return obj;
}

function loadTsConfigFile(filePath: string): unknown {
  const source = fs.readFileSync(filePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  });

  const module = { exports: {} as { default?: unknown } };
  const localRequire = (id: string) => {
    if (id.includes("defineConfig") || id.includes("/config")) {
      return { defineConfig: (config: unknown) => config };
    }
    throw new Error(`config cannot import ${id}`);
  };

  new Function("require", "module", "exports", outputText)(
    localRequire,
    module,
    module.exports,
  );

  return module.exports.default ?? module.exports;
}

export function loadConfig(
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): BotConfig {
  const botPath = path.join(cwd, "bot.config.ts");
  const examplePath = path.join(cwd, "config", "example.config.ts");
  const filePath = fs.existsSync(botPath)
    ? botPath
    : fs.existsSync(examplePath)
      ? examplePath
      : null;

  const fileValue = filePath ? loadTsConfigFile(filePath) : {};
  return parseBotConfig(applyDealbotEnv(fileValue, env));
}
