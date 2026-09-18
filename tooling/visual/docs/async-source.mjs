import ts from 'typescript';

/** Browser bridge for a source async data component, not a React Flight server.
 * Only a zero-prop component with one awaited data binding and one return is
 * accepted. The fetch function and returned JSX remain the original source.
 */
export function adaptAsyncComponents(code, filename, framework) {
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const f = ts.factory;
  const components = source.statements.filter((node) => ts.isFunctionDeclaration(node) && /^[A-Z]/.test(node.name?.text ?? '') && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword));
  if (!components.length) return {code, components: []};
  let suffix = 0;
  while (code.includes(`__docs_async_data_${suffix}`)) suffix++;
  const local = `__docs_async_data_${suffix}`;
  const prepared = [];
  const changes = new Map();
  for (const [index, node] of components.entries()) {
    const [binding, returned] = node.body?.statements ?? [];
    const declaration = binding && ts.isVariableStatement(binding) && binding.declarationList.declarations.length === 1 ? binding.declarationList.declarations[0] : undefined;
    if (node.parameters.length || node.body?.statements.length !== 2 || !declaration || !ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isAwaitExpression(declaration.initializer) || !ts.isCallExpression(declaration.initializer.expression) || !ts.isReturnStatement(returned))
      throw new Error(`${filename}: ${node.name.text} needs an explicit async component bridge.`);
    const originalCall = declaration.initializer.expression;
    let argument;
    if (framework === 'react') {
      const cache = f.createIdentifier(`${local}_cache_${index}`);
      prepared.push(f.createVariableStatement(undefined, f.createVariableDeclarationList([f.createVariableDeclaration(cache)], ts.NodeFlags.Let)));
      argument = f.createBinaryExpression(cache, ts.SyntaxKind.QuestionQuestionEqualsToken, originalCall);
    } else argument = f.createArrowFunction(undefined, undefined, [], undefined, f.createToken(ts.SyntaxKind.EqualsGreaterThanToken), originalCall);
    const nextBinding = f.updateVariableStatement(binding, binding.modifiers, f.updateVariableDeclarationList(binding.declarationList, [f.updateVariableDeclaration(declaration, declaration.name, declaration.exclamationToken, declaration.type, f.createCallExpression(f.createIdentifier(local), undefined, [argument]))]));
    changes.set(node, f.updateFunctionDeclaration(node, node.modifiers.filter((modifier) => modifier.kind !== ts.SyntaxKind.AsyncKeyword), node.asteriskToken, node.name, node.typeParameters, node.parameters, undefined, f.updateBlock(node.body, [nextBinding, returned])));
  }
  const imported = f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports([f.createImportSpecifier(false, f.createIdentifier(framework === 'react' ? 'use' : 'useAsync'), f.createIdentifier(local))])), f.createStringLiteral(framework === 'react' ? 'react' : '@solid-cn/docs/async'));
  return {code: ts.createPrinter().printFile(f.updateSourceFile(source, [imported, ...prepared, ...source.statements.map((node) => changes.get(node) ?? node)])), components: components.map((node) => node.name.text)};
}
