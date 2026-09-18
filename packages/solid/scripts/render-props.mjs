import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const source=path.resolve(new URL('../src',import.meta.url).pathname);
const f=ts.factory;
for(const entry of fs.readdirSync(source,{recursive:true}).filter(name=>name.endsWith('.tsx'))){
 const file=path.join(source,entry),code=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let changed=false;
 const result=ts.transform(ast,[context=>{
  function nodeWithProps(node){
   const attrs=ts.isJsxElement(node)?node.openingElement.attributes:node.attributes;
   if(attrs.properties.some(attr=>ts.isJsxSpreadAttribute(attr)&&attr.expression.getText(ast).startsWith('mergeRenderProps(')))return node;
   const sources=[f.createIdentifier('renderProps')];
   for(const attr of attrs.properties){
    if(ts.isJsxSpreadAttribute(attr)){if(attr.expression.getText(ast)!=='renderProps')sources.push(attr.expression);continue;}
    const value=!attr.initializer?f.createTrue():ts.isStringLiteral(attr.initializer)?attr.initializer:attr.initializer.expression??f.createTrue();
    sources.push(f.createObjectLiteralExpression([f.createGetAccessorDeclaration(undefined,f.createStringLiteral(attr.name.text),[],undefined,f.createBlock([f.createReturnStatement(value)],true))]));
   }
   const merged=f.updateJsxAttributes(attrs,[f.createJsxSpreadAttribute(f.createCallExpression(f.createIdentifier('mergeRenderProps'),undefined,sources))]);changed=true;
   return ts.isJsxSelfClosingElement(node)?f.updateJsxSelfClosingElement(node,node.tagName,node.typeArguments,merged):f.updateJsxElement(node,f.updateJsxOpeningElement(node.openingElement,node.openingElement.tagName,node.openingElement.typeArguments,merged),node.children,node.closingElement);
  }
  function renderValue(node){
   if(ts.isArrowFunction(node)||ts.isFunctionExpression(node)){
    if(ts.isArrowFunction(node)&&(ts.isJsxElement(node.body)||ts.isJsxSelfClosingElement(node.body))&&node.parameters[0]?.name.getText(ast)==='renderProps')return f.updateArrowFunction(node,node.modifiers,node.typeParameters,node.parameters,node.type,node.equalsGreaterThanToken,nodeWithProps(node.body));
    return node;
   }
   if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node))return f.createArrowFunction(undefined,undefined,[f.createParameterDeclaration(undefined,undefined,'renderProps',undefined,f.createTypeReferenceNode('Record',[f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)]))],undefined,undefined,nodeWithProps(node));
   return ts.visitEachChild(node,renderValue,context);
  }
  const visit=node=>ts.isJsxAttribute(node)&&node.name.text==='render'&&node.initializer&&ts.isJsxExpression(node.initializer)&&node.initializer.expression?f.updateJsxAttribute(node,node.name,f.createJsxExpression(undefined,renderValue(node.initializer.expression))):ts.visitEachChild(node,visit,context);
  return node=>ts.visitNode(node,visit);
 }]);
 if(changed)fs.writeFileSync(file,(code.includes('import { mergeRenderProps }')?'':`import { mergeRenderProps } from '${entry.startsWith('internal/')?'../':'./'}utils';\n`)+ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(result.transformed[0]));
 result.dispose();
}
