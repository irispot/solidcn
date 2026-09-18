import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const upstream=path.resolve(root,'../..');
fs.copyFileSync(path.join(upstream,'packages/shadcn/src/tailwind.css'),path.join(root,'src/styles/tailwind.css'));
const globals=fs.readFileSync(path.join(upstream,'apps/v4/app/globals.css'),'utf8');
function block(prefix){const start=globals.indexOf(prefix);if(start<0)throw new Error(`Missing style section ${prefix}`);let depth=0;for(let index=globals.indexOf('{',start);index<globals.length;index++){if(globals[index]==='{')depth++;if(globals[index]==='}'&&!--depth)return globals.slice(start,index+1);}throw new Error(`Unclosed style section ${prefix}`);}
fs.writeFileSync(path.join(root,'src/styles/theme.css'),['@custom-variant dark (&:is(.dark *));',block('@theme inline'),block(':root {'),block('.dark {'),'@theme inline { --animate-accordion-down: accordion-down .2s ease-out; --animate-accordion-up: accordion-up .2s ease-out; }'].join('\n\n')+'\n');
