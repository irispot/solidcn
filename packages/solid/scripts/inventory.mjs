import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const original=path.resolve(root,'../../apps/v4/registry/bases/base/ui');
const files=fs.readdirSync(original).filter(name=>name.endsWith('.tsx')).sort();
const extra=fs.readdirSync(path.resolve(root,'../../apps/v4/registry/new-york-v4/ui')).filter(name=>name.endsWith('.tsx')&&!files.includes(name));
const names=new Set();const exports=[];
for(const file of files){
 const source=path.join(root,'src',file);if(!fs.existsSync(source))throw new Error(`Missing ${file}`);
 const ast=ts.createSourceFile(source,fs.readFileSync(source,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const local=[];
 for(const statement of ast.statements){
  if(ts.isExportDeclaration(statement)&&statement.exportClause&&ts.isNamedExports(statement.exportClause))for(const specifier of statement.exportClause.elements){if(!names.has(specifier.name.text)){names.add(specifier.name.text);local.push(specifier.name.text);}}
  if(statement.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword)){
   if(ts.isFunctionDeclaration(statement)&&statement.name){if(!names.has(statement.name.text)){names.add(statement.name.text);local.push(statement.name.text);}}
   if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations){const name=declaration.name.getText(ast);if(!names.has(name)){names.add(name);local.push(name);}}
  }
 }
 if(local.length)exports.push(`export { ${local.join(', ')} } from './${file.slice(0,-4)}';`);
}
fs.writeFileSync(path.join(root,'src/index.ts'),exports.join('\n')+'\n');
fs.copyFileSync(path.resolve(root,'../../LICENSE.md'),path.join(root,'LICENSE'));
console.log(JSON.stringify({canonical:files.length,exports:names.size,legacyExtra:extra},null,2));
