import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Mechanical syntax adjustments for Solid 2. It processes this package only.
const src = path.resolve(new URL('../src',import.meta.url).pathname);
for (const entry of fs.readdirSync(src,{recursive:true})) {
  if(!entry.endsWith('.tsx'))continue;
  const file=path.join(src,entry);
  let code=fs.readFileSync(file,'utf8');
  code=code.replace(/([A-Za-z]+Context|Context)\.Provider/g,'$1');
  code=code.replace(/\bspellCheck=/g,'spellcheck=').replace(/\binputMode=/g,'inputmode=').replace(/\btabIndex=/g,'tabindex=');
  code=code.replace('aria-selected={isSelected(date)}','aria-selected={isSelected(date) ? "true" : "false"}');
  code=code.replace('aria-disabled={props.disabled} aria-selected={context.current() === entry.value()}','aria-disabled={props.disabled ? "true" : "false"} aria-selected={context.current() === entry.value() ? "true" : "false"}');
  code=code.replace('props.inputMode ??','props.inputmode ??');
  code=code.replace('first?.compareDocumentPosition(beforeFirst) & Node.DOCUMENT_POSITION_FOLLOWING','first && (first.compareDocumentPosition(beforeFirst) & Node.DOCUMENT_POSITION_FOLLOWING)');
  code=code.replace("event.currentTarget.type === 'radio'", "event.currentTarget.type === 'radio' && event.currentTarget.checked");
  const ast=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const result=ts.transform(ast,[context=>{
    const visit=node=>{
      if(ts.isTypeReferenceNode(node)&&node.typeName.getText(ast)==='Pick'&&!(ts.isTypeReferenceNode(node.parent)&&node.parent.typeName.getText(ast)==='Partial'))return ts.factory.createTypeReferenceNode('Partial',[ts.visitEachChild(node,visit,context)]);
      return ts.visitEachChild(node,visit,context);
    };
    return node=>ts.visitNode(node,visit);
  }]);
  fs.writeFileSync(file,ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(result.transformed[0]));
  result.dispose();
}
