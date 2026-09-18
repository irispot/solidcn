import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const source=path.resolve(new URL('../src',import.meta.url).pathname);
for(const entry of fs.readdirSync(source,{recursive:true}).filter(name=>name.endsWith('.tsx'))){
 const file=path.join(source,entry);const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let changed=false;
 const result=ts.transform(ast,[context=>{const visit=node=>{
  if(ts.isJsxAttribute(node)&&node.name.text.startsWith('data-')&&node.initializer&&ts.isJsxExpression(node.initializer)&&node.initializer.expression&&!(ts.isCallExpression(node.initializer.expression)&&node.initializer.expression.expression.getText(ast)==='dataValue')){
   changed=true;return ts.factory.updateJsxAttribute(node,node.name,ts.factory.createJsxExpression(undefined,ts.factory.createCallExpression(ts.factory.createIdentifier('dataValue'),undefined,[ts.visitNode(node.initializer.expression,visit)])));
  }
  return ts.visitEachChild(node,visit,context);
 };return node=>ts.visitNode(node,visit);}]);
 if(changed){const prefix=ast.text.includes('import { dataValue }')?'':`import { dataValue } from '${entry.startsWith('internal/')?'../':'./'}utils';\n`;fs.writeFileSync(file,prefix+ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(result.transformed[0]));}
 result.dispose();
}
