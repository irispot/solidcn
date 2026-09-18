import ts from 'typescript';
import { format } from 'prettier';
import { readFile } from 'node:fs/promises';

// Source-driven wrappers only. No existing native output is read by this generator.
export async function generate({ inputs, options: recipeOptions = {} }) {
  if (inputs.length !== 1) throw new Error('Stateless wrappers require one source input.');
  const input = inputs[0];
  const source = ts.createSourceFile(
    input.path,
    input.code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  if (source.parseDiagnostics.length) throw new Error('Invalid upstream TSX.');
  const f = ts.factory;
  const id = f.createIdentifier;
  const str = f.createStringLiteral;
  const call = (name, args) => f.createCallExpression(id(name), undefined, args);
  const fail = (node, reason = ts.SyntaxKind[node.kind]) => {
    const at = source.getLineAndCharacterOfPosition(node.getStart(source));
    throw new Error(
      `${input.path}:${at.line + 1}:${at.character + 1}: Unsupported stateless wrapper: ${reason}`,
    );
  };
  const imports = new Map();
  const variants = new Set();
  const typeNames = new Map([
    ['ComponentProps', 'ComponentProps'],
    ['ComponentPropsWithRef', 'ComponentProps'],
    ['ReactNode', 'JSX.Element'],
    ['CSSProperties', 'JSX.CSSProperties'],
  ]);
  const moduleName = (name) => {
    if (name === 'cn') return './utils';
    if (/^@base-ui\/react\/[\w-]+$/.test(name))
      return name.replace('@base-ui/react/', '@solid-cn/base-ui/');
    if (/^@\/registry\/bases\/base\/ui\/[\w-]+$/.test(name))
      return name.replace('@/registry/bases/base/ui/', './');
    if (name === '@/app/(create)/components/icon-placeholder') return './icons';
    if (name === 'class-variance-authority') return name;
    if (name === 'cmdk') return './internal/command';
    if (name === 'react-resizable-panels') return './internal/resizable';
    if (/^@shadcn\/react\/[\w-]+$/.test(name)) return name.replace('@shadcn/react/', './internal/');
    return null;
  };
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const name = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (!clause || clause.name || !clause.namedBindings)
      fail(statement, 'side-effect/default import');
    if (name === 'react') {
      if (!ts.isNamespaceImport(clause.namedBindings) || clause.namedBindings.name.text !== 'React')
        fail(statement, 'React hook or alias import');
      continue;
    }
    if (!moduleName(name)) fail(statement, `import ${name}`);
    const entries = ts.isNamedImports(clause.namedBindings)
      ? clause.namedBindings.elements
      : [clause.namedBindings];
    for (const entry of entries)
      imports.set(entry.name.text, {
        module: name,
        original: entry.propertyName?.text ?? entry.name.text,
      });
  }
  const checkReact = (node) => {
    if (ts.isIdentifier(node) && node.text === 'React') {
      const parent = node.parent;
      if (!(
        ts.isNamespaceImport(parent) ||
        (ts.isQualifiedName(parent) &&
          parent.left === node &&
          typeNames.has(parent.right.text) &&
          ts.isTypeReferenceNode(parent.parent))
      ))
        fail(node, 'runtime or unsupported React use');
    }
    ts.forEachChild(node, checkReact);
  };
  checkReact(source);
  const literal = (node) =>
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(
      node.kind,
    ) ||
    (ts.isPrefixUnaryExpression(node) &&
      [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(node.operator) &&
      ts.isNumericLiteral(node.operand));
  const staticValue = (node) =>
    literal(node) ||
    (ts.isArrayLiteralExpression(node) && node.elements.every(staticValue)) ||
    (ts.isObjectLiteralExpression(node) &&
      node.properties.every(
        (property) =>
          ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) ||
            ts.isStringLiteral(property.name) ||
            ts.isNumericLiteral(property.name)) &&
          staticValue(property.initializer),
      ));
  const cvaName = [...imports].find(
    ([, value]) => value.module === 'class-variance-authority' && value.original === 'cva',
  )?.[0];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!(statement.declarationList.flags & ts.NodeFlags.Const)) fail(statement, 'mutable setup');
    for (const declaration of statement.declarationList.declarations) {
      const value = declaration.initializer;
      if (
        ts.isIdentifier(declaration.name) &&
        value &&
        ts.isPropertyAccessExpression(value) &&
        ts.isIdentifier(value.expression) &&
        imports.get(value.expression.text)?.module.startsWith('@base-ui/react/')
      )
        continue;
      if (
        !ts.isIdentifier(declaration.name) ||
        !value ||
        !ts.isCallExpression(value) ||
        !ts.isIdentifier(value.expression) ||
        value.expression.text !== cvaName ||
        !value.arguments.length ||
        !value.arguments.every(staticValue)
      )
        fail(declaration, 'nonliteral CVA declaration or setup value');
      variants.add(declaration.name.text);
    }
  }
  let serial = 0;
  let dataUsed = false;
  let renderUsed = false;
  const optionalPicks = new Map(
    (recipeOptions.optionalPicks ?? []).map((entry) => [
      entry.source.replace(/\s/g, ''),
      { ...entry, seen: 0 },
    ]),
  );
  const transformed = ts.transform(source, [
    (context) => {
      let bindings = new Map();
      let inFunction = false;
      const getter = (name, value) =>
        f.createGetAccessorDeclaration(
          undefined,
          name,
          [],
          undefined,
          f.createBlock([f.createReturnStatement(value)], true),
        );
      const visit = (node) => {
        if (ts.isSourceFile(node)) return ts.visitEachChild(node, visit, context);
        if (ts.isImportDeclaration(node)) {
          if (node.moduleSpecifier.text === 'react') return undefined;
          return f.updateImportDeclaration(
            node,
            node.modifiers,
            node.importClause,
            str(moduleName(node.moduleSpecifier.text)),
            node.attributes,
          );
        }
        if (
          ts.isExpressionStatement(node) &&
          ts.isStringLiteral(node.expression) &&
          node.expression.text === 'use client'
        )
          return undefined;
        if (ts.isVariableStatement(node) && node.parent === source) return node;
        if (ts.isFunctionDeclaration(node)) {
          if (
            node.parent !== source ||
            !node.name ||
            node.typeParameters?.length ||
            node.asteriskToken ||
            node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
            node.parameters.length !== 1 ||
            !node.body ||
            node.body.statements.length !== 1 ||
            !ts.isReturnStatement(node.body.statements[0])
          )
            fail(node, 'stateful or nested function');
          let returned = node.body.statements[0].expression;
          while (returned && ts.isParenthesizedExpression(returned)) returned = returned.expression;
          if (
            !returned ||
            !(
              ts.isJsxElement(returned) ||
              ts.isJsxSelfClosingElement(returned) ||
              ts.isJsxFragment(returned) ||
              (ts.isCallExpression(returned) &&
                ts.isIdentifier(returned.expression) &&
                imports.get(returned.expression.text)?.original === 'useRender')
            )
          )
            fail(node, 'non-JSX or non-useRender return');
          const parameter = node.parameters[0];
          if (
            !parameter.type ||
            parameter.initializer ||
            !(ts.isObjectBindingPattern(parameter.name) || ts.isIdentifier(parameter.name))
          )
            fail(parameter, 'parameter shape');
          if (ts.isIdentifier(parameter.name)) {
            inFunction = true;
            const body = ts.visitNode(node.body, visit);
            inFunction = false;
            return f.updateFunctionDeclaration(
              node,
              node.modifiers,
              undefined,
              node.name,
              undefined,
              [
                f.updateParameterDeclaration(
                  parameter,
                  parameter.modifiers,
                  undefined,
                  parameter.name,
                  parameter.questionToken,
                  ts.visitNode(parameter.type, visit),
                  undefined,
                ),
              ],
              ts.visitNode(node.type, visit),
              body,
            );
          }
          const name = `__props${serial++}`;
          const keys = parameter.name.elements
            .filter((entry) => !entry.dotDotDotToken)
            .map((entry) => (entry.propertyName ?? entry.name).text);
          bindings = new Map();
          for (const entry of parameter.name.elements) {
            if (
              !ts.isIdentifier(entry.name) ||
              (entry.propertyName && !ts.isIdentifier(entry.propertyName)) ||
              (entry.initializer && !literal(entry.initializer))
            )
              fail(entry, 'nested prop binding or computed default');
            const key = (entry.propertyName ?? entry.name).text;
            const access = () =>
              entry.dotDotDotToken
                ? call('omitProps', [id(name), f.createArrayLiteralExpression(keys.map(str))])
                : key === 'className'
                  ? f.createBinaryExpression(
                      f.createPropertyAccessExpression(id(name), 'className'),
                      f.createToken(ts.SyntaxKind.QuestionQuestionToken),
                      f.createPropertyAccessExpression(id(name), 'class'),
                    )
                  : f.createPropertyAccessExpression(id(name), key);
            bindings.set(entry.name.text, () =>
              entry.initializer
                ? f.createConditionalExpression(
                    f.createBinaryExpression(
                      access(),
                      f.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
                      id('undefined'),
                    ),
                    undefined,
                    entry.initializer,
                    undefined,
                    access(),
                  )
                : access(),
            );
          }
          inFunction = true;
          const body = ts.visitNode(node.body, visit);
          inFunction = false;
          bindings = new Map();
          const type = ts.visitNode(parameter.type, visit);
          return f.updateFunctionDeclaration(
            node,
            node.modifiers,
            undefined,
            node.name,
            undefined,
            [
              f.updateParameterDeclaration(
                parameter,
                parameter.modifiers,
                undefined,
                id(name),
                parameter.questionToken,
                type,
                undefined,
              ),
            ],
            ts.visitNode(node.type, visit),
            body,
          );
        }
        if (ts.isTypeReferenceNode(node)) {
          const name = node.typeName.getText(source);
          const optional = optionalPicks.get(node.getText(source).replace(/\s/g, ''));
          if (name === 'Pick' && optional) {
            optional.seen++;
            return f.createTypeReferenceNode('Partial', [
              f.updateTypeReferenceNode(
                node,
                node.typeName,
                node.typeArguments?.map((arg) => ts.visitNode(arg, visit)),
              ),
            ]);
          }
          if (name.startsWith('React.'))
            return f.createTypeReferenceNode(
              typeNames.get(name.slice(6)),
              node.typeArguments?.map((arg) => ts.visitNode(arg, visit)),
            );
          if (name === 'useRender.ComponentProps')
            return f.createTypeReferenceNode(
              'ComponentProps',
              node.typeArguments?.map((arg) => ts.visitNode(arg, visit)),
            );
          if (name.endsWith('.Props')) {
            const parts = name.slice(0, -6).split('.');
            if (!imports.has(parts[0])) fail(node, 'unknown primitive Props');
            const entity = parts
              .slice(1)
              .reduce((left, part) => f.createQualifiedName(left, part), id(parts[0]));
            return f.createTypeReferenceNode('ComponentProps', [f.createTypeQueryNode(entity)]);
          }
        }
        if (ts.isJsxAttribute(node)) {
          const aliases = {
            className: 'class',
            tabIndex: 'tabindex',
            htmlFor: 'for',
            autoFocus: 'autofocus',
            autoComplete: 'autocomplete',
            readOnly: 'readonly',
            spellCheck: 'spellcheck',
            inputMode: 'inputmode',
            maxLength: 'maxlength',
            minLength: 'minlength',
          };
          if (node.name.text === 'key') fail(node, 'React key');
          let value = ts.visitNode(node.initializer, visit);
          if (node.name.text.startsWith('aria-') && !value) value = str('true');
          if (
            node.name.text.startsWith('data-') &&
            value &&
            ts.isJsxExpression(value) &&
            value.expression
          ) {
            dataUsed = true;
            value = f.createJsxExpression(undefined, call('dataValue', [value.expression]));
          }
          if (
            node.name.text === 'render' &&
            value &&
            ts.isJsxExpression(value) &&
            value.expression
          ) {
            const direct =
              ts.isJsxElement(value.expression) || ts.isJsxSelfClosingElement(value.expression);
            const renderValue = (jsx) => {
              if (!(ts.isJsxElement(jsx) || ts.isJsxSelfClosingElement(jsx)))
                return ts.visitEachChild(jsx, renderValue, context);
              renderUsed = true;
              const attrs = ts.isJsxElement(jsx) ? jsx.openingElement.attributes : jsx.attributes;
              const sources = [id('renderProps')];
              for (const attribute of attrs.properties) {
                if (ts.isJsxSpreadAttribute(attribute)) sources.push(attribute.expression);
                else
                  sources.push(
                    f.createObjectLiteralExpression([
                      getter(
                        str(attribute.name.text),
                        !attribute.initializer
                          ? f.createTrue()
                          : ts.isStringLiteral(attribute.initializer)
                            ? attribute.initializer
                            : (attribute.initializer.expression ?? f.createTrue()),
                      ),
                    ]),
                  );
              }
              const merged = f.updateJsxAttributes(attrs, [
                f.createJsxSpreadAttribute(call('mergeRenderProps', sources)),
              ]);
              const body = ts.isJsxSelfClosingElement(jsx)
                ? f.updateJsxSelfClosingElement(jsx, jsx.tagName, jsx.typeArguments, merged)
                : f.updateJsxElement(
                    jsx,
                    f.updateJsxOpeningElement(
                      jsx.openingElement,
                      jsx.openingElement.tagName,
                      jsx.openingElement.typeArguments,
                      merged,
                    ),
                    jsx.children,
                    jsx.closingElement,
                  );
              return f.createArrowFunction(
                undefined,
                undefined,
                [
                  f.createParameterDeclaration(
                    undefined,
                    undefined,
                    'renderProps',
                    undefined,
                    direct
                      ? f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
                      : f.createTypeReferenceNode('Record', [
                          f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
                          f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
                        ]),
                  ),
                ],
                undefined,
                undefined,
                body,
              );
            };
            value = f.createJsxExpression(undefined, renderValue(value.expression));
          }
          return f.updateJsxAttribute(
            node,
            aliases[node.name.text] ? id(aliases[node.name.text]) : node.name,
            value,
          );
        }
        if (inFunction && ts.isShorthandPropertyAssignment(node)) {
          if (!bindings.has(node.name.text)) fail(node, 'unknown shorthand value');
          return getter(node.name, bindings.get(node.name.text)());
        }
        if (inFunction && ts.isPropertyAssignment(node)) {
          if (ts.isComputedPropertyName(node.name)) fail(node, 'computed object key');
          const value = ts.visitNode(node.initializer, visit);
          return literal(node.initializer)
            ? f.updatePropertyAssignment(node, node.name, value)
            : getter(node.name, value);
        }
        if (ts.isIdentifier(node) && bindings.has(node.text)) {
          const parent = node.parent;
          if (!(
            (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
            (ts.isPropertyAssignment(parent) && parent.name === node) ||
            ts.isJsxAttribute(parent) ||
            ts.isExportSpecifier(parent)
          ))
            return bindings.get(node.text)();
        }
        if (ts.isCallExpression(node)) {
          const name = ts.isIdentifier(node.expression) ? node.expression.text : '';
          const sourceImport = imports.get(name);
          if (!(
            variants.has(name) ||
            (sourceImport?.module === '@/registry/bases/base/ui/button' &&
              sourceImport.original === 'buttonVariants') ||
            (sourceImport?.module === 'cn' && sourceImport.original === 'cn') ||
            (sourceImport?.module === '@base-ui/react/merge-props' &&
              sourceImport.original === 'mergeProps') ||
            (sourceImport?.module === '@base-ui/react/use-render' &&
              sourceImport.original === 'useRender')
          ))
            fail(node, 'call outside pure wrapper allowlist');
          return f.updateCallExpression(
            node,
            node.expression,
            name === 'mergeProps'
              ? undefined
              : node.typeArguments?.map((arg) => ts.visitNode(arg, visit)),
            node.arguments.map((arg) => ts.visitNode(arg, visit)),
          );
        }
        if (ts.isExportDeclaration(node)) {
          if (!node.moduleSpecifier) return node;
          const mapped = moduleName(node.moduleSpecifier.text);
          if (!mapped) fail(node, 'unknown re-export');
          return f.updateExportDeclaration(
            node,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            str(mapped),
            node.attributes,
          );
        }
        if (
          ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node) ||
          ts.isVariableStatement(node) ||
          ts.isIfStatement(node) ||
          ts.isClassDeclaration(node) ||
          ts.isAwaitExpression(node) ||
          ts.isNewExpression(node) ||
          ts.isDeleteExpression(node) ||
          ts.isTaggedTemplateExpression(node) ||
          ts.isPostfixUnaryExpression(node) ||
          (ts.isPrefixUnaryExpression(node) &&
            [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) ||
          ts.isGetAccessorDeclaration(node) ||
          ts.isSetAccessorDeclaration(node) ||
          (ts.isBinaryExpression(node) &&
            node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
          (ts.isJsxSpreadAttribute(node) && !ts.isIdentifier(node.expression))
        )
          fail(node);
        if (
          node.parent === source &&
          !ts.isTypeAliasDeclaration(node) &&
          !ts.isInterfaceDeclaration(node)
        )
          fail(node, 'top-level setup');
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit);
    },
  ]);
  for (const entry of optionalPicks.values())
    if (entry.seen !== entry.count)
      throw new Error(
        `Optional Pick override expected ${entry.count} occurrences, found ${entry.seen}: ${entry.source}`,
      );
  const header =
    '// Native Solid 2 port of the upstream Base UI registry.\nimport { createSignal, createMemo, createEffect, createContext, useContext, createUniqueId, type Component } from "solid-js";\nimport type { JSX } from "@solidjs/web";\nimport { omitProps, type ComponentProps } from "./utils";\n';
  const prefix =
    (renderUsed ? "import { mergeRenderProps } from './utils';\n" : '') +
    (dataUsed ? "import { dataValue } from './utils';\n" : '');
  const printed =
    prefix +
    header +
    ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]);
  transformed.dispose();
  const options = JSON.parse(await readFile(new URL('./format.json', import.meta.url), 'utf8'));
  return format(printed, { ...options, parser: 'typescript' });
}
