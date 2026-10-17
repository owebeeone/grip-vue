import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const temporary = mkdtempSync(join(tmpdir(), "grip-vue-package-"));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}
try {
  const packed = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", temporary]))[0];
  const consumer = join(temporary, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "grip-vue-consumer-check", private: true, type: "module" }),
  );
  run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(temporary, packed.filename)],
    consumer,
  );
  const exports = [
    "createGripPlugin",
    "GripScope",
    "GripInput",
    "GripTextarea",
    "useBufferedGripInput",
    "GripGraphVisualizer",
    "GraphDumpButton",
    "GraphDumpDialog",
  ];
  const assertion = `for (const name of ${JSON.stringify(exports)}) { if (!api[name]) { throw new Error('Missing export: ' + name); } }`;
  run(
    "node",
    ["--input-type=module", "-e", `import * as api from '@owebeeone/grip-vue'; ${assertion}`],
    consumer,
  );
  run(
    "node",
    ["--input-type=commonjs", "-e", `const api = require('@owebeeone/grip-vue'); ${assertion}`],
    consumer,
  );
  writeFileSync(
    join(consumer, "check.ts"),
    `
import { defineComponent, h } from 'vue';
import { Grip, Grok, GripRegistry, type AtomTapHandle } from '@owebeeone/grip-core';
import { GripScope, GripInput, useBufferedGripInput, GripGraphVisualizer, GraphDumpButton, GraphDumpDialog } from '@owebeeone/grip-vue';
const grok = new Grok(new GripRegistry());
h(GripGraphVisualizer, { grok, refreshMs: 500, fitToPane: true });
h(GraphDumpButton, { grok });
h(GraphDumpDialog, { grok, open: true, onClose: () => {} });
const value = new Grip<number>({ name: 'Consumer.Count' });
const handle = new Grip<AtomTapHandle<number>>({ name: 'Consumer.CountHandle' });
export const Counter = defineComponent({ setup() {
  const input = useBufferedGripInput(value, handle, { parse: text => text === '' ? undefined : Number(text) });
  const text: string = input.text.value;
  return () => h(GripScope, { scopeKey: 'counter' }, () => h(GripInput, { grip: value, tapGrip: handle, 'aria-label': text }));
} });
`,
  );
  writeFileSync(join(consumer, 'check.cts'), readFileSync(join(consumer, 'check.ts')));
  run(
    process.execPath,
    [
      resolve(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--module",
      "nodenext",
      "--target",
      "ES2022",
      "--skipLibCheck",
      "false",
      "check.ts",
      "check.cts",
    ],
    consumer,
  );
  console.log("Packed ESM, CommonJS, and TypeScript consumer checks passed.");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
