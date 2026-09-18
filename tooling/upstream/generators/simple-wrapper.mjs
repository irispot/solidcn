import ts from 'typescript';
import { format } from 'prettier';
import { readFile } from 'node:fs/promises';

/** Narrow source-to-source generator. It does not read the existing native file. */
export async function generate({ inputs }) {
  if (inputs.length !== 1) throw new Error('The wrapper generator needs one source input.');
  const input = inputs[0];
  const source = ts.createSourceFile(
    input.path,
    input.code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  if (source.parseDiagnostics.length) throw new Error('The upstream wrapper has invalid TSX.');
  const f = ts.factory;
  const ident = f.createIdentifier;
  const string = f.createStringLiteral;
  let functionCount = 0;
  const unsupported = (node) => {
    const point = source.getLineAndCharacterOfPosition(node.getStart(source));
    throw new Error(
      `${input.path}:${point.line + 1}:${point.character + 1}: The simple-wrapper generator does not support ${ts.SyntaxKind[node.kind]}. Review and extend the generator explicitly.`,
    );
  };
  // Only this erased React type is supported. Check every use before removing
  // its namespace import, so a new runtime use cannot disappear silently.
  const checkReact = (node) => {
    if (ts.isIdentifier(node) && node.text === 'React') {
      const parent = node.parent;
      if (!(
        (ts.isNamespaceImport(parent) && parent.name === node) ||
        (ts.isQualifiedName(parent) &&
          parent.left === node &&
          parent.right.text === 'ComponentProps' &&
          ts.isTypeReferenceNode(parent.parent) &&
          parent.parent.typeName === parent)
      ))
        unsupported(node);
    }
    ts.forEachChild(node, checkReact);
  };
  checkReact(source);
  const result = ts.transform(source, [
    (context) => {
      let bindings = new Map();
      const visit = (node) => {
        if (ts.isSourceFile(node)) return ts.visitEachChild(node, visit, context);
        if (ts.isImportDeclaration(node)) {
          const name = node.moduleSpecifier.text;
          if (name === 'react') {
            const clause = node.importClause;
            if (
              !clause ||
              clause.name ||
              !clause.namedBindings ||
              !ts.isNamespaceImport(clause.namedBindings) ||
              clause.namedBindings.name.text !== 'React'
            )
              unsupported(node);
            return undefined;
          }
          if (!node.importClause || !(name === 'cn' || /^@base-ui\/react\/[\w-]+$/.test(name)))
            unsupported(node);
          return f.updateImportDeclaration(
            node,
            node.modifiers,
            node.importClause,
            string(
              name === 'cn' ? './utils' : name.replace('@base-ui/react/', '@solid-cn/base-ui/'),
            ),
            node.attributes,
          );
        }
        if (
          ts.isExpressionStatement(node) &&
          ts.isStringLiteral(node.expression) &&
          node.expression.text === 'use client'
        )
          return undefined;
        if (ts.isFunctionDeclaration(node)) {
          if (
            node.parent !== source ||
            !node.name ||
            node.parameters.length !== 1 ||
            node.typeParameters?.length ||
            node.type ||
            node.asteriskToken ||
            node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
            !node.body ||
            node.body.statements.length !== 1 ||
            !ts.isReturnStatement(node.body.statements[0])
          )
            unsupported(node);
          let returned = node.body.statements[0].expression;
          while (returned && ts.isParenthesizedExpression(returned)) returned = returned.expression;
          if (
            !returned ||
            !(
              ts.isJsxElement(returned) ||
              ts.isJsxSelfClosingElement(returned) ||
              ts.isJsxFragment(returned)
            )
          )
            unsupported(node.body.statements[0]);
          const parameter = node.parameters[0];
          if (
            !ts.isObjectBindingPattern(parameter.name) ||
            !parameter.type ||
            parameter.initializer
          )
            unsupported(parameter);
          const parameterName = `__props${functionCount++}`;
          const names = parameter.name.elements
            .filter((entry) => !entry.dotDotDotToken)
            .map((entry) => (entry.propertyName ?? entry.name).text);
          bindings = new Map();
          for (const entry of parameter.name.elements) {
            if (
              !ts.isIdentifier(entry.name) ||
              (entry.propertyName && !ts.isIdentifier(entry.propertyName)) ||
              (entry.initializer &&
                !ts.isStringLiteral(entry.initializer) &&
                !ts.isNumericLiteral(entry.initializer) &&
                ![ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(
                  entry.initializer.kind,
                ))
            )
              unsupported(entry);
            const key = (entry.propertyName ?? entry.name).text;
            const access = () =>
              entry.dotDotDotToken
                ? f.createCallExpression(ident('omitProps'), undefined, [
                    ident(parameterName),
                    f.createArrayLiteralExpression(names.map(string)),
                  ])
                : key === 'className'
                  ? f.createBinaryExpression(
                      f.createPropertyAccessExpression(ident(parameterName), 'className'),
                      f.createToken(ts.SyntaxKind.QuestionQuestionToken),
                      f.createPropertyAccessExpression(ident(parameterName), 'class'),
                    )
                  : f.createPropertyAccessExpression(ident(parameterName), key);
            bindings.set(entry.name.text, () =>
              entry.initializer
                ? f.createConditionalExpression(
                    f.createBinaryExpression(
                      access(),
                      f.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
                      ident('undefined'),
                    ),
                    undefined,
                    entry.initializer,
                    undefined,
                    access(),
                  )
                : access(),
            );
          }
          const body = ts.visitNode(node.body, visit);
          bindings = new Map();
          const type = ts.visitNode(parameter.type, visit);
          return f.updateFunctionDeclaration(
            node,
            node.modifiers,
            node.asteriskToken,
            node.name,
            undefined,
            [
              f.updateParameterDeclaration(
                parameter,
                parameter.modifiers,
                undefined,
                ident(parameterName),
                parameter.questionToken,
                type,
                undefined,
              ),
            ],
            node.type,
            body,
          );
        }
        if (
          ts.isTypeReferenceNode(node) &&
          node.typeName.getText(source) === 'React.ComponentProps'
        )
          return f.createTypeReferenceNode('ComponentProps', node.typeArguments);
        if (ts.isJsxAttribute(node))
          return f.updateJsxAttribute(
            node,
            node.name.text === 'className' ? ident('class') : node.name,
            ts.visitNode(node.initializer, visit),
          );
        if (ts.isIdentifier(node) && bindings.has(node.text)) {
          const parent = node.parent;
          if (!(
            (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
            ts.isJsxAttribute(parent)
          ))
            return bindings.get(node.text)();
        }
        // These constructs need scope or behavior transforms which this recipe does not provide.
        if (
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) ||
          ts.isVariableStatement(node) ||
          ts.isIfStatement(node) ||
          ts.isClassDeclaration(node) ||
          (ts.isJsxSpreadAttribute(node) && !ts.isIdentifier(node.expression))
        )
          unsupported(node);
        if (
          ts.isCallExpression(node) &&
          (!ts.isIdentifier(node.expression) || node.expression.text !== 'cn')
        )
          unsupported(node);
        if (ts.isExportDeclaration(node) && node.moduleSpecifier) unsupported(node);
        if (node.parent === source && !ts.isExportDeclaration(node)) unsupported(node);
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit);
    },
  ]);
  if (!functionCount)
    throw new Error('The simple-wrapper generator requires a stateless function.');
  // Retain the established port header so replay does not create unrelated formatting diffs.
  const header =
    '// Native Solid 2 port of the upstream Base UI registry.\nimport { createSignal, createMemo, createEffect, createContext, useContext, createUniqueId, type Component } from "solid-js";\nimport type { JSX } from "@solidjs/web";\nimport { omitProps, type ComponentProps } from "./utils";\n';
  const code =
    header +
    ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(result.transformed[0]);
  result.dispose();
  const options = JSON.parse(await readFile(new URL('./format.json', import.meta.url), 'utf8'));
  return format(code, { ...options, parser: 'typescript' });
}
