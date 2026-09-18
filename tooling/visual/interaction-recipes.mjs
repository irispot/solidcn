import ts from 'typescript';

// Recipes use the public Shadcn slot attributes. They never change the source
// example or simulate events inside the component. Playwright sends real input.
const recipes = [
  ['DropdownMenuTrigger', 'dropdown-menu', 'click'],
  ['SelectTrigger', 'select', 'click'],
  ['ComboboxTrigger', 'combobox', 'click'],
  ['DialogTrigger', 'dialog', 'click'],
  ['AlertDialogTrigger', 'alert-dialog', 'click'],
  ['PopoverTrigger', 'popover', 'click'],
  ['TooltipTrigger', 'tooltip', 'hover'],
  ['HoverCardTrigger', 'hover-card', 'hover'],
  ['ContextMenuTrigger', 'context-menu', 'right-click'],
  ['SheetTrigger', 'sheet', 'click'],
  ['DrawerTrigger', 'drawer', 'click'],
  ['NavigationMenuTrigger', 'navigation-menu', 'hover'],
  ['MenubarTrigger', 'menubar', 'click'],
];

export function discoverInteractionStates(code, filename, existing = []) {
  const source = ts.createSourceFile(
    filename,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const imports = new Map();
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || !/\/(?:ui|ui-rtl)\//.test(node.moduleSpecifier.text))
      continue;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const binding of bindings.elements)
      imports.set(binding.name.text, binding.propertyName?.text ?? binding.name.text);
  }
  const enabledTags = new Set();
  const isDisabled = (attributes) =>
    attributes.properties.some((attribute) => {
      if (!ts.isJsxAttribute(attribute) || attribute.name.text !== 'disabled') return false;
      return (
        !attribute.initializer ||
        (ts.isJsxExpression(attribute.initializer) &&
          attribute.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword)
      );
    });
  function visit(node, disabled = false) {
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : undefined;
    if (opening) {
      disabled ||= isDisabled(opening.attributes);
      if (!disabled && ts.isIdentifier(opening.tagName))
        enabledTags.add(imports.get(opening.tagName.text));
    }
    ts.forEachChild(node, (child) => visit(child, disabled));
  }
  visit(source);
  const states = [];
  const enabled = recipes.filter(([tag]) => enabledTags.has(tag));
  for (const [tag, component, action] of enabled) {
    const popup = `[data-slot='${component}-content']`;
    // Roles are shared by unrelated components. A manual recipe must identify
    // its trigger type or exact popup slot before it can replace this recipe.
    if (
      existing.some(
        (state) =>
          state.actions?.length &&
          (state.covers?.includes(component) || state.popups?.includes(popup)),
      )
    )
      continue;
    const selector = `[data-slot='${component}-trigger']:not([disabled]):not([aria-disabled='true']):visible >> nth=0`;
    states.push({
      name: `open-${component}`,
      recipe: `${component}:first-enabled-trigger`,
      actions: [
        { type: action === 'click' ? 'open' : action, selector },
        { type: 'wait', selector: popup },
      ],
      popups: [popup],
    });
  }
  return states;
}
