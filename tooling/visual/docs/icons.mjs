import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import ts from "typescript";

function literal(node, constants, file) {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node))
    return ts.isStringLiteral(node) ? node.text : Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node) && constants.has(node.text))
    return literal(constants.get(node.text), constants, file);
  if (ts.isArrayLiteralExpression(node))
    return node.elements.map((entry) => literal(entry, constants, file));
  if (ts.isObjectLiteralExpression(node))
    return Object.fromEntries(
      node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property))
          throw new Error(
            `${file}: icon attributes must be literal properties.`,
          );
        return [
          property.name.text,
          literal(property.initializer, constants, file),
        ];
      }),
    );
  throw new Error(`${file}: non-literal icon data is not supported.`);
}

/** Extract path data without importing or evaluating React or the icon package. */
export async function readIconDefinitions(kind, names, dependencies) {
  if (!["lucide", "tabler"].includes(kind))
    throw new Error(`Unknown icon vendor: ${kind}`);
  const packageName =
    kind === "lucide" ? "lucide-react" : "@tabler/icons-react";
  const packageRoot = resolve(dependencies, packageName);
  const manifest = JSON.parse(
    await readFile(resolve(packageRoot, "package.json"), "utf8"),
  );
  const barrel = resolve(
    packageRoot,
    kind === "lucide"
      ? "dist/esm/lucide-react.js"
      : "dist/esm/tabler-icons-react.mjs",
  );
  const exports = new Map();
  const barrelSource = ts.createSourceFile(
    barrel,
    await readFile(barrel, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  for (const statement of barrelSource.statements)
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const specifier of statement.exportClause.elements)
        exports.set(
          specifier.name.text,
          resolve(dirname(barrel), statement.moduleSpecifier.text),
        );
    }
  const definitions = [];
  for (const name of [...new Set(names)].sort()) {
    const file = exports.get(name);
    if (!file)
      throw new Error(
        `${packageName}@${manifest.version}: missing icon export ${name}`,
      );
    const source = ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const constants = new Map();
    let factory;
    function scan(node) {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      )
        constants.set(node.name.text, node.initializer);
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text ===
          (kind === "lucide" ? "createLucideIcon" : "createReactComponent")
      )
        factory = node;
      ts.forEachChild(node, scan);
    }
    scan(source);
    if (!factory)
      throw new Error(`${file}: no supported icon factory was found.`);
    const args = factory.arguments.map((node) =>
      literal(node, constants, file),
    );
    const iconName =
      kind === "lucide"
        ? args[0].replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
        : args[1];
    const nodes = kind === "lucide" ? args[1] : args[3];
    if (
      !Array.isArray(nodes) ||
      nodes.some(
        (node) =>
          !Array.isArray(node) ||
          !/^[a-z]+$/.test(node[0]) ||
          typeof node[1] !== "object",
      )
    )
      throw new Error(`${file}: invalid SVG node data.`);
    definitions.push({
      name,
      iconName,
      nodes: nodes.map(([tag, attributes]) => [
        tag,
        Object.fromEntries(
          Object.entries(attributes).filter(([key]) => key !== "key"),
        ),
      ]),
      type: kind === "lucide" ? "outline" : args[0],
      source: file,
      package: packageName,
      version: manifest.version,
    });
  }
  return definitions;
}

export function generateIconModule(kind, definitions) {
  const declarations = definitions
    .map(
      (definition) =>
        `export function ${definition.name}(props) { return <DocIcon {...props} definition={${JSON.stringify(definition)}} />; }`,
    )
    .join("\n");
  return `// SVG data is read from ${kind === "lucide" ? "lucide-react (ISC)" : "@tabler/icons-react (MIT)"}. No React runtime is used.
import { Dynamic } from '@solidjs/web';
import { omitProps } from 'virtual:solid-doc-runtime';
function DocIcon(props) {
  const definition = () => props.definition;
  const lucide = ${kind === "lucide"};
  const size = () => props.size ?? 24;
  return <svg xmlns="http://www.w3.org/2000/svg" width={size()} height={size()} viewBox="0 0 24 24"
    fill={definition().type === 'filled' ? props.color ?? 'currentColor' : 'none'}
    stroke={definition().type === 'filled' ? undefined : props.color ?? 'currentColor'}
    stroke-width={definition().type === 'filled' ? undefined : lucide ? props.absoluteStrokeWidth ? Number(props.strokeWidth ?? 2) * 24 / Number(size()) : props.strokeWidth ?? 2 : props.stroke ?? 2}
    stroke-linecap="round" stroke-linejoin="round"
    class={[lucide ? 'lucide' : 'tabler-icon', (lucide ? 'lucide-' : 'tabler-icon-') + definition().iconName, props.class ?? props.className].filter(Boolean).join(' ')}
    {...omitProps(props, ['definition','color','size','strokeWidth','absoluteStrokeWidth','class','className','children',...(!lucide ? ['stroke','title'] : [])])}>
    {!lucide && props.title && <title>{props.title}</title>}
    {definition().nodes.map(([tag, attributes]) => <Dynamic component={tag} {...attributes} />)}
    {props.children}
  </svg>;
}
${declarations}
`;
}
