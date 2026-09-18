import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// This migration only reads upstream files. It never reads or writes tests.
const here = path.dirname(new URL(import.meta.url).pathname);
const upstream = path.resolve(here, '../../../apps/v4/registry/bases/base/ui');
const output = path.resolve(here, '../src');
const manual = new Set(['calendar', 'carousel', 'chart', 'sonner']);
const files = fs.readdirSync(upstream).filter(n => n.endsWith('.tsx') && !manual.has(n.slice(0, -4)));
const program = ts.createProgram(files.map(n => path.join(upstream, n)), { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest, noResolve: true });
const checker = program.getTypeChecker();
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
fs.mkdirSync(output, {recursive:true});
for (const filename of files) {
  const sf = program.getSourceFile(path.join(upstream, filename));
  const replacements = new Map();
  const params = new Map();
  const declarations = new Map();
  const reactiveDeclarations = new Set();
  let serial = 0;
  const f = ts.factory;
  const symbol = node => checker.getSymbolAtLocation(node);
  const ident = name => f.createIdentifier(name);
  const call = (name,args=[]) => f.createCallExpression(ident(name),undefined,args);
  function scan(node) {
    if (ts.isParameter(node) && ts.isObjectBindingPattern(node.name)) {
      const pname = `__props${serial++}`;
      const keys = node.name.elements.filter(el => !el.dotDotDotToken).map(el => (el.propertyName ?? el.name).text);
      params.set(node, pname);
      for (const el of node.name.elements) {
        const key = (el.propertyName ?? el.name).text;
        const access = () => el.dotDotDotToken
          ? call('omitProps', [ident(pname), f.createArrayLiteralExpression(keys.map(k=>f.createStringLiteral(k)))])
          : key === 'className' ? f.createBinaryExpression(f.createPropertyAccessExpression(ident(pname),'className'), f.createToken(ts.SyntaxKind.QuestionQuestionToken), f.createPropertyAccessExpression(ident(pname),'class'))
          : f.createPropertyAccessExpression(ident(pname), key);
        replacements.set(symbol(el.name), () => el.initializer ? f.createParenthesizedExpression(f.createConditionalExpression(f.createBinaryExpression(access(), f.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken), ident('undefined')), undefined, el.initializer, undefined, access())) : access());
      }
    }
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name) && ['open', 'state', 'hasSnapPoints', 'swipeAxis', '_values'].includes(node.name.text) && node.initializer && !ts.isArrowFunction(node.initializer)) {
        reactiveDeclarations.add(node);
        replacements.set(symbol(node.name), () => call(node.name.text));
      }
      if (ts.isIdentifier(node.name) && node.initializer?.expression?.getText(sf) === 'useIsMobile') replacements.set(symbol(node.name), () => call(node.name.text));
      if (ts.isArrayBindingPattern(node.name) && node.initializer?.expression?.getText(sf) === 'React.useState') {
        const binding = node.name.elements[0];
        if (binding && ts.isBindingElement(binding)) replacements.set(symbol(binding.name),()=>call(binding.name.text));
      }
      if (ts.isIdentifier(node.name) && node.initializer && /^(React\.)?useMemo$/.test(node.initializer.expression?.getText(sf)??'')) replacements.set(symbol(node.name),()=>call(node.name.text));
      if (ts.isObjectBindingPattern(node.name) && node.initializer) {
        const dname = `__local${serial++}`;
        declarations.set(node,dname);
        const computed = !ts.isCallExpression(node.initializer);
        for(const el of node.name.elements) if(!el.dotDotDotToken) replacements.set(symbol(el.name),()=>f.createPropertyAccessExpression(computed ? call(dname) : ident(dname),(el.propertyName??el.name).text));
      }
    }
    ts.forEachChild(node,scan);
  }
  scan(sf);
  const result = ts.transform(sf, [ctx => {
    const visit = node => {
      if(ts.isExportDeclaration(node) && node.moduleSpecifier?.text.startsWith('@base-ui/react')) return f.updateExportDeclaration(node,node.modifiers,node.isTypeOnly,node.exportClause,f.createStringLiteral(node.moduleSpecifier.text.replace('@base-ui/react','@solid-cn/base-ui')),node.attributes);
      if (ts.isImportDeclaration(node)) {
        let mod = node.moduleSpecifier.text;
        if(mod === 'react') return undefined;
        mod = mod.replace('@base-ui/react','@solid-cn/base-ui').replace(/^@\/registry\/bases\/base\/ui\//,'./').replace(/^@\/registry\/bases\/base\/hooks\/use-mobile$/,'./use-mobile').replace('cn','cn');
        if(mod === 'cn') mod='./utils';
        if(mod.includes('icon-placeholder')) mod='./icons';
        if(mod === 'cmdk') mod='./internal/command';
        if(mod === 'input-otp') mod='./internal/input-otp';
        if(mod === 'react-resizable-panels') mod='./internal/resizable';
        if(mod.startsWith('@shadcn/react/')) mod=mod.replace('@shadcn/react/','./internal/');
        return f.updateImportDeclaration(node,node.modifiers,node.importClause,f.createStringLiteral(mod),node.attributes);
      }
      if(ts.isExpressionStatement(node) && node.expression.text === 'use client') return undefined;
      if(ts.isParameter(node) && params.has(node)) return f.updateParameterDeclaration(node,node.modifiers,node.dotDotDotToken,ident(params.get(node)),node.questionToken,ts.visitNode(node.type,visit),node.initializer);
      if(ts.isVariableDeclaration(node) && reactiveDeclarations.has(node)) return f.updateVariableDeclaration(node,node.name,node.exclamationToken,undefined,f.createArrowFunction(undefined,undefined,[],undefined,undefined,ts.visitNode(node.initializer,visit)));
      if(ts.isVariableDeclaration(node) && declarations.has(node)) return f.updateVariableDeclaration(node,ident(declarations.get(node)),node.exclamationToken,undefined,ts.isCallExpression(node.initializer)?ts.visitNode(node.initializer,visit):f.createArrowFunction(undefined,undefined,[],undefined,undefined,ts.visitNode(node.initializer,visit)));
      if (ts.isFunctionDeclaration(node) && ['Sidebar','FieldError','ToastIcon'].includes(node.name?.text)) {
        const transformed = ts.visitEachChild(node,visit,ctx);
        const statements = [...transformed.body.statements];
        let split = statements.findIndex(statement => !ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const));
        if(split < 0) split = 0;
        const memo = f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration('__view',undefined,undefined,call('createMemo',[f.createArrowFunction(undefined,undefined,[],undefined,undefined,f.createBlock(statements.slice(split),true))]))],ts.NodeFlags.Const));
        const lazy = f.createReturnStatement(f.createJsxFragment(f.createJsxOpeningFragment(),[f.createJsxExpression(undefined,call('__view'))],f.createJsxJsxClosingFragment()));
        return f.updateFunctionDeclaration(transformed,transformed.modifiers,transformed.asteriskToken,transformed.name,transformed.typeParameters,transformed.parameters,transformed.type,f.createBlock([...statements.slice(0,split),memo,lazy],true));
      }
      if(ts.isPropertyAssignment(node) && (()=>{let ancestor=node.parent;while(ancestor){if(ts.isFunctionLike(ancestor))return true;ancestor=ancestor.parent;}return false;})() && !ts.isFunctionExpression(node.initializer) && !ts.isArrowFunction(node.initializer) && !ts.isStringLiteral(node.initializer) && !ts.isNumericLiteral(node.initializer) && ![ts.SyntaxKind.TrueKeyword,ts.SyntaxKind.FalseKeyword,ts.SyntaxKind.NullKeyword].includes(node.initializer.kind)) return f.createGetAccessorDeclaration(undefined,node.name,[],undefined,f.createBlock([f.createReturnStatement(ts.visitNode(node.initializer,visit))],true));
      if(ts.isPropertyAccessExpression(node) && node.name.text==='Provider' && /Context$/.test(node.expression.getText(sf))) return ts.visitNode(node.expression,visit);
      if(ts.isShorthandPropertyAssignment(node)) {
        const value = checker.getShorthandAssignmentValueSymbol(node);
        if(replacements.has(value)) return f.createGetAccessorDeclaration(undefined,node.name,[],undefined,f.createBlock([f.createReturnStatement(ts.visitNode(replacements.get(value)(),visit))],true));
      }
      if(ts.isIdentifier(node) && replacements.has(symbol(node))) {
        const parent=node.parent;
        const isName = (ts.isPropertyAccessExpression(parent) && parent.name===node) || (ts.isPropertyAssignment(parent) && parent.name===node) || ts.isBindingElement(parent) || ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isJsxAttribute(parent) || ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent);
        if(!isName) return ts.visitEachChild(replacements.get(symbol(node))(),visit,ctx);
      }
      if(ts.isCallExpression(node)) {
        const name=node.expression.getText(sf);
        if(name==='React.useState') return f.createCallExpression(ident('createSignal'),node.typeArguments,node.arguments.map(a=>ts.visitNode(a,visit)));
        if(name==='React.createContext'||name==='React.useContext') return f.createCallExpression(ident(name.split('.')[1]),node.typeArguments?.map(a=>ts.visitNode(a,visit)),node.arguments.map(a=>ts.visitNode(a,visit)));
        if(name==='React.useId') return call('createUniqueId');
        if(name==='React.useMemo'||name==='useMemo') return f.createCallExpression(ident('createMemo'),node.typeArguments?.map(a=>ts.visitNode(a,visit)),[ts.visitNode(node.arguments[0],visit)]);
        if(name==='React.useCallback') return ts.visitNode(node.arguments[0],visit);
        if(name==='React.useEffect') return call('createEffect',[f.createArrowFunction(undefined,undefined,[],undefined,undefined,ts.visitNode(node.arguments[1]??f.createArrayLiteralExpression(),visit)),ts.visitNode(node.arguments[0],visit)]);
        if(name==='React.useRef') return f.createObjectLiteralExpression([f.createPropertyAssignment('current',node.arguments[0]??ident('undefined'))]);
        if(name==='mergeProps' && node.typeArguments) return f.updateCallExpression(node,ts.visitNode(node.expression,visit),undefined,node.arguments.map(a=>ts.visitNode(a,visit)));
      }
      if(ts.isTypeReferenceNode(node)) {
        const name=node.typeName.getText(sf);
        if(name==='React.ComponentProps'||name==='React.ComponentPropsWithRef'||name==='useRender.ComponentProps') return f.createTypeReferenceNode('ComponentProps',node.typeArguments?.map(a=>ts.visitNode(a,visit)));
        if(name.endsWith('.Props')) return f.createTypeReferenceNode('ComponentProps',[f.createTypeQueryNode(name.slice(0,-6).split('.').reduce((a,b)=>a?f.createQualifiedName(a,b):ident(b),null))]);
        if(name==='React.ReactNode') return f.createTypeReferenceNode('JSX.Element');
        if(name==='React.CSSProperties') return f.createTypeReferenceNode('JSX.CSSProperties');
        if(name==='React.ComponentType') return f.createTypeReferenceNode('Component');
        if(name==='React.KeyboardEvent') return f.createTypeReferenceNode('KeyboardEvent');
      }
      if(ts.isJsxAttribute(node)) {
        if(node.name.text==='key') return undefined;
        const attributes={tabIndex:'tabindex',spellCheck:'spellcheck',autoComplete:'autocomplete',autoFocus:'autofocus',inputMode:'inputmode',htmlFor:'for',readOnly:'readonly',maxLength:'maxlength',minLength:'minlength'};
        if(attributes[node.name.text]) return f.updateJsxAttribute(node,ident(attributes[node.name.text]),ts.visitNode(node.initializer,visit));
        if(node.name.text==='className') return f.updateJsxAttribute(node,ident('class'),ts.visitNode(node.initializer,visit));
        if(node.name.text==='render' && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && (ts.isJsxElement(node.initializer.expression)||ts.isJsxSelfClosingElement(node.initializer.expression))) {
          const jsx=ts.visitNode(node.initializer.expression,visit);
          const prepend=attrs=>f.updateJsxAttributes(attrs,[f.createJsxSpreadAttribute(ident('renderProps')),...attrs.properties]);
          const body=ts.isJsxSelfClosingElement(jsx)?f.updateJsxSelfClosingElement(jsx,jsx.tagName,jsx.typeArguments,prepend(jsx.attributes)):f.updateJsxElement(jsx,f.updateJsxOpeningElement(jsx.openingElement,jsx.openingElement.tagName,jsx.openingElement.typeArguments,prepend(jsx.openingElement.attributes)),jsx.children,jsx.closingElement);
          return f.updateJsxAttribute(node,node.name,f.createJsxExpression(undefined,f.createArrowFunction(undefined,undefined,[f.createParameterDeclaration(undefined,undefined,'renderProps',undefined,f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword))],undefined,undefined,body)));
        }
      }
      return ts.visitEachChild(node,visit,ctx);
    };
    return node=>ts.visitNode(node,visit);
  }]);
  const prefix='// Native Solid 2 port of the upstream Base UI registry.\nimport { createSignal, createMemo, createEffect, createContext, useContext, createUniqueId, type Component } from "solid-js";\nimport type { JSX } from "@solidjs/web";\nimport { omitProps, type ComponentProps } from "./utils";\n';
  fs.writeFileSync(path.join(output,filename),prefix+printer.printFile(result.transformed[0]));
  result.dispose();
}
// Keep the original theme declarations. Consumers choose a style on their app root.
fs.mkdirSync(path.resolve(output,'styles'),{recursive:true});
for(const name of fs.readdirSync(path.resolve(upstream,'../../../styles')).filter(n=>n.endsWith('.css'))) fs.copyFileSync(path.resolve(upstream,'../../../styles',name),path.resolve(output,'styles',name));
console.log(`Converted ${files.length} component modules; ${manual.size} native modules are maintained separately.`);
