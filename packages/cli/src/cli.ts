#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseIcDocumentJson,
  type ICDocumentV1,
} from '@infinite-canvas-tutorial/ecs/document';
import {
  serializedNodesToCode,
  type CodeFramework,
  type CodeVariablesMode,
} from '@infinite-canvas-tutorial/ecs/codegen';

type Command = 'validate' | 'inspect' | 'codegen';
type Options = {
  command: Command;
  file: string;
  output?: string;
  json: boolean;
  framework: CodeFramework;
  variablesMode: CodeVariablesMode;
  componentName?: string;
};

const usage = `Usage: ic <command> <file.ic> [options]

Commands:
  validate                 Validate a .ic document
  inspect [--json]         Summarize its nodes, variables, and asset references
  codegen                  Generate HTML/CSS or React/Tailwind source

Codegen options:
  --framework <name>       html-css or react-tailwind (default: react-tailwind)
  --variables-mode <mode>  resolved or css-var (default: resolved)
  --component-name <name>  React component name (default: Design)
  -o, --output <path>      Write to a file instead of stdout
`;

function readValue(args: string[], index: number, option: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('-'))
    throw new Error(`Missing value for ${option}`);
  return value;
}

function parseArgs(args: string[]): Options | undefined {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h')
    return undefined;
  const [command, file, ...rest] = args;
  if (command !== 'validate' && command !== 'inspect' && command !== 'codegen')
    throw new Error(`Unknown command: ${command}`);
  if (!file || file.startsWith('-')) throw new Error('Missing .ic file path');
  const options: Options = {
    command,
    file,
    json: false,
    framework: 'react-tailwind',
    variablesMode: 'resolved',
  };
  for (let i = 0; i < rest.length; i++) {
    const option = rest[i];
    if (option === '--json') {
      if (command !== 'inspect') throw new Error('--json requires inspect');
      options.json = true;
      continue;
    }
    if (command !== 'codegen') throw new Error(`${option} requires codegen`);
    if (option === '--framework') {
      const value = readValue(rest, i++, option);
      if (value !== 'html-css' && value !== 'react-tailwind')
        throw new Error(`Unsupported framework: ${value}`);
      options.framework = value;
    } else if (option === '--variables-mode') {
      const value = readValue(rest, i++, option);
      if (value !== 'resolved' && value !== 'css-var')
        throw new Error(`Unsupported variables mode: ${value}`);
      options.variablesMode = value;
    } else if (option === '--component-name') {
      const value = readValue(rest, i++, option);
      if (!/^[A-Za-z_$][A-Za-z\d_$]*$/.test(value))
        throw new Error(`Invalid component name: ${value}`);
      options.componentName = value;
    } else if (option === '--output' || option === '-o') {
      options.output = readValue(rest, i++, option);
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }
  return options;
}

function inspect(doc: ICDocumentV1) {
  const nodes = doc.elements.filter((node) => !node.isDeleted);
  const assets = {
    dataUrls: new Set<string>(),
    blobUrls: new Set<string>(),
    remoteUrls: new Set<string>(),
  };
  function visit(value: unknown): void {
    if (typeof value === 'string') {
      if (value.startsWith('data:image/')) assets.dataUrls.add(value);
      else if (value.startsWith('blob:')) assets.blobUrls.add(value);
      else if (/^https?:\/\//.test(value)) assets.remoteUrls.add(value);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(visit);
    }
  }
  nodes.forEach(visit);
  return {
    nodes: nodes.length,
    roots: nodes.filter((node) => !node.parentId).map((node) => node.id),
    reusable: nodes.filter((node) => node.reusable).map((node) => node.id),
    variables: Object.keys(doc.variables).sort(),
    assets: {
      dataUrls: assets.dataUrls.size,
      blobUrls: assets.blobUrls.size,
      remoteUrls: assets.remoteUrls.size,
    },
  };
}

function run(options: Options) {
  const path = resolve(options.file);
  let doc: ICDocumentV1;
  try {
    doc = parseIcDocumentJson(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(
      `${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (options.command === 'validate') {
    process.stdout.write(`Valid .ic document: ${doc.elements.length} nodes\n`);
    return;
  }
  if (options.command === 'inspect') {
    const summary = inspect(doc);
    process.stdout.write(
      options.json
        ? `${JSON.stringify(summary, null, 2)}\n`
        : `${summary.nodes} nodes, ${summary.roots.length} roots, ${summary.reusable.length} reusable, ${summary.variables.length} variables\n`,
    );
    return;
  }
  const output = serializedNodesToCode(doc.elements, {
    framework: options.framework,
    variablesMode: options.variablesMode,
    componentName: options.componentName,
    variables: doc.variables,
    themeMode: doc.themes.mode ?? doc.appState.themeMode,
  });
  if (output.includes('blob:'))
    throw new Error(
      'Temporary blob: assets cannot be exported by the CLI; use data URLs or persistent URLs',
    );
  if (options.output) writeFileSync(resolve(options.output), output);
  else process.stdout.write(output);
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options) run(options);
  else process.stdout.write(usage);
} catch (error) {
  process.stderr.write(
    `ic: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
