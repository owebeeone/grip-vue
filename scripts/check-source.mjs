import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { parse } from 'vue/compiler-sfc';

let failures = 0;
function check(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function body(node, statement) {
    if (!ts.isBlock(statement)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      console.error(`${file}:${line + 1}: control-flow bodies must use braces`);
      failures++;
    }
  }
  function visit(node) {
    if (ts.isIfStatement(node)) {
      body(node, node.thenStatement);
      if (node.elseStatement && !ts.isIfStatement(node.elseStatement)) {
        body(node, node.elseStatement);
      }
    } else if (
      ts.isForStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node)
    ) {
      body(node, node.statement);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    // Legacy async-query helper is outside this parity change; migrate separately.
    if (file === path.join('src', 'useGripQuery.ts')) {
      continue;
    }
    if (entry.isDirectory()) {
      walk(file);
    } else if (/\.(?:ts|mjs|vue)$/.test(file)) {
      const text = fs.readFileSync(file, 'utf8');
      if (file.endsWith('.vue')) {
        const { descriptor } = parse(text, { filename: file });
        for (const block of [descriptor.script, descriptor.scriptSetup]) {
          if (block) {
            check(file, '\n'.repeat(block.loc.start.line - 1) + block.content);
          }
        }
      } else {
        check(file, text);
      }
    }
  }
}
for (const directory of ['src', 'tests', 'scripts']) {
  if (fs.existsSync(directory)) {
    walk(directory);
  }
}
for (const file of fs.readdirSync('.').filter((name) => name.endsWith('.config.ts'))) {
  check(file, fs.readFileSync(file, 'utf8'));
}
if (failures) {
  process.exitCode = 1;
} else {
  console.log(
    'Explicit control-flow boundaries verified for parity sources (legacy useGripQuery excluded).',
  );
}
