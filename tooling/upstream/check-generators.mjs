import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { generate as wrapper } from './generators/stateless-wrapper.mjs';
import { generate as entry } from './generators/base-entry.mjs';
import { currentProvenance, directory, loadRecipe, pins, regenerate } from './replay-lib.mjs';

// Isolated generator diagnostics. No original test file is opened or changed.
export async function checkGenerators() {
  let wrapperChanges = 0;
  let entryChanges = 0;
  let typeSurfaceChangesRejected = 0;
  for (const item of currentProvenance().modules) {
    const recipe = loadRecipe(item.module);
    if (
      !recipe ||
      !['generators/stateless-wrapper.mjs', 'generators/base-entry.mjs'].includes(recipe.generator)
    )
      continue;
    const repository = item.module.split('/')[0];
    const baseline = await regenerate(item.module, pins()[repository].commit);
    assert.equal(baseline.code, readFileSync(item.module, 'utf8'), item.module);
    const input = baseline.inputs[0];
    const source = ts.createSourceFile(
      input.path,
      input.code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let start;
    let end;
    let replacement;
    if (recipe.generator === 'generators/stateless-wrapper.mjs') {
      function findClass(node) {
        if (
          start === undefined &&
          ts.isStringLiteral(node) &&
          ((ts.isJsxAttribute(node.parent) && node.parent.name.text === 'className') ||
            (ts.isCallExpression(node.parent) &&
              node.parent.arguments[0] === node &&
              ['cn', 'cva'].includes(node.parent.expression.getText(source))))
        ) {
          start = node.getStart(source);
          end = node.end;
          replacement = JSON.stringify(`${node.text} replay-candidate-v2`);
        }
        ts.forEachChild(node, findClass);
      }
      findClass(source);
      if (start === undefined) {
        function findSlot(node) {
          if (
            start === undefined &&
            ts.isStringLiteral(node) &&
            ts.isJsxAttribute(node.parent) &&
            node.parent.name.text === 'data-slot'
          ) {
            start = node.getStart(source);
            end = node.end;
            replacement = JSON.stringify(`${node.text}-replay-candidate-v2`);
          }
          ts.forEachChild(node, findSlot);
        }
        findSlot(source);
      }
      if (start === undefined) {
        const declaration = source.statements.find(
          (node) =>
            ts.isExportDeclaration(node) &&
            node.moduleSpecifier &&
            node.exportClause &&
            ts.isNamedExports(node.exportClause),
        );
        assert.ok(declaration, `No supported candidate mutation for ${item.module}`);
        const name = declaration.exportClause.elements[0].name;
        start = name.getStart(source);
        end = name.end;
        replacement = `${name.text} as ReplayCandidateV2`;
      }
      wrapperChanges++;
    } else {
      const declaration = source.statements.find(
        (node) => ts.isExportDeclaration(node) && !node.isTypeOnly,
      );
      if (!declaration.exportClause) {
        start = declaration.moduleSpecifier.getStart(source);
        end = declaration.moduleSpecifier.end;
        replacement = JSON.stringify(`${declaration.moduleSpecifier.text}CandidateV2`);
      } else {
        const clause = declaration.exportClause;
        const name = ts.isNamespaceExport(clause)
          ? clause.name
          : clause.elements.find((item) => !item.isTypeOnly).name;
        start = name.getStart(source);
        end = name.end;
        replacement =
          ts.isNamespaceExport(clause) || name.parent.propertyName
            ? `${name.text}CandidateV2`
            : `${name.text} as ${name.text}CandidateV2`;
      }
      entryChanges++;
      await assert.rejects(
        () =>
          entry({
            inputs: [
              {
                ...input,
                code: `${input.code}\nexport type { CandidateType } from './candidate';\n`,
              },
            ],
            options: recipe.options,
          }),
        /type export surface changed/,
      );
      typeSurfaceChangesRejected++;
    }
    const generator = await import(pathToFileURL(resolve(directory, recipe.generator)).href);
    const output = await generator.generate({
      inputs: [
        { ...input, code: input.code.slice(0, start) + replacement + input.code.slice(end) },
      ],
      options: recipe.options,
    });
    assert.notEqual(output, baseline.generated, item.module);
    assert.match(output, /replay-candidate-v2|ReplayCandidateV2|CandidateV2/, item.module);
  }

  const fixture = (version) => ({
    path: `candidate-${version}.tsx`,
    code: readFileSync(resolve(directory, `fixtures/candidate-${version}.tsx`), 'utf8'),
  });
  const version1 = await wrapper({ inputs: [fixture('v1')] });
  const version2 = await wrapper({ inputs: [fixture('v2')] });
  assert.notEqual(version1, version2);
  for (const text of ['cn-candidate-v2', 'bg-amber-100', 'Candidate two', 'New upstream title'])
    assert.ok(version2.includes(text), text);
  assert.match(version2, /__props0\.tone === undefined \? 'warning' : __props0\.tone/);
  assert.match(version2, /get tone\(\)/);
  assert.match(version2, /mergeRenderProps/);
  assert.match(version2, /dataValue/);
  assert.doesNotMatch(version2, /from ['"]react['"]/);

  for (const [name, code] of [
    ['runtime React', fixture('v1').code.replace('variants({ tone })', 'React.useState(tone)')],
    [
      'setup capture',
      fixture('v1').code.replace('  return (', '  const captured = tone;\n  return ('),
    ],
    ['impure CVA', fixture('v1').code.replace("'bg-white'", 'Date.now()')],
    ['callback', fixture('v1').code.replace('data-tone={tone}', 'onClick={() => alert(tone)}')],
    ['unknown import', fixture('v1').code.replace("from 'cn'", "from 'unreviewed-lib'")],
    ['mutation', fixture('v1').code.replace('data-tone={tone}', 'data-tone={tone++}')],
  ])
    await assert.rejects(
      () => wrapper({ inputs: [{ path: `${name}.tsx`, code }] }),
      /Unsupported stateless wrapper/,
      name,
    );

  return {
    passed: true,
    sourceDrivenWrappers: wrapperChanges,
    sourceDrivenEntries: entryChanges,
    changedTypeSurfacesRejected: typeSurfaceChangesRejected,
    syntheticCandidateVersionsChecked: 2,
    unsafePatternsRejected: 6,
    originalTestsReadOrChanged: false,
    behaviorAccepted: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await checkGenerators(), null, 2));
}
