import ts from "typescript";
import { resolveExampleImport } from "./import-adapters.mjs";
import { adaptAsyncComponents } from './async-source.mjs';
import { fixExampleInputs } from './example-input-fixes.mjs';

export const TRANSFORM_VERSION = 8;
// React's SVG property aliases (React DOM, MIT) differ from native JSX names.
// Restrict the mapping to intrinsic elements. A component's own props keep
// their authored names, and case-sensitive SVG names such as viewBox stay intact.
const svgAttributeAliases = new Map(
  `accentHeight alignmentBaseline arabicForm baselineShift capHeight clipPath
  clipRule colorInterpolation colorInterpolationFilters colorProfile colorRendering
  dominantBaseline enableBackground fillOpacity fillRule floodColor floodOpacity
  fontFamily fontSize fontSizeAdjust fontStretch fontStyle fontVariant fontWeight
  glyphName glyphOrientationHorizontal glyphOrientationVertical horizAdvX horizOriginX
  imageRendering letterSpacing lightingColor markerEnd markerMid markerStart
  overlinePosition overlineThickness paintOrder pointerEvents renderingIntent
  shapeRendering stopColor stopOpacity strikethroughPosition strikethroughThickness
  strokeDasharray strokeDashoffset strokeLinecap strokeLinejoin strokeMiterlimit
  strokeOpacity strokeWidth textAnchor textDecoration textRendering transformOrigin
  underlinePosition underlineThickness unicodeBidi unicodeRange unitsPerEm
  vAlphabetic vHanging vIdeographic vMathematical vectorEffect vertAdvY vertOriginX
  vertOriginY wordSpacing writingMode xHeight`
    .split(/\s+/)
    .map((name) => [name, name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)]),
);
svgAttributeAliases.set('xmlnsXlink', 'xmlns:xlink');
export const SUPPORTED_REACT_HOOKS = [
  "useState",
  "useEffect",
  "useLayoutEffect",
  "useMemo",
  "useId",
  "useRef",
  "useCallback",
];
// These are the named imports used by the cloned Rhea examples. Both presets
// come from registry/bases/base/ui, but their generated style classes differ.
// This route uses the existing native components under the suite's Nova CSS.
// It does not implement or claim Rhea style parity. check-transform verifies
// each name against both actual source modules before this list can pass.
export const RHEA_NOVA_IMPORT_ROUTES = Object.freeze({
  attachment:
    "Attachment AttachmentAction AttachmentActions AttachmentContent AttachmentDescription AttachmentGroup AttachmentMedia AttachmentTitle AttachmentTrigger",
  avatar: "Avatar AvatarFallback AvatarImage",
  badge: "Badge",
  bubble: "Bubble BubbleContent BubbleGroup BubbleReactions",
  button: "Button",
  card: "Card CardAction CardContent CardDescription CardFooter CardHeader CardTitle",
  collapsible: "Collapsible CollapsibleTrigger",
  dialog:
    "Dialog DialogContent DialogDescription DialogHeader DialogTitle DialogTrigger",
  drawer:
    "Drawer DrawerClose DrawerContent DrawerDescription DrawerFooter DrawerHeader DrawerTitle DrawerTrigger",
  "dropdown-menu":
    "DropdownMenu DropdownMenuContent DropdownMenuGroup DropdownMenuItem DropdownMenuLabel DropdownMenuSeparator DropdownMenuTrigger",
  empty: "Empty EmptyDescription EmptyHeader EmptyMedia EmptyTitle",
  field: "Field FieldContent FieldDescription FieldLabel FieldTitle",
  "hover-card": "HoverCard HoverCardContent HoverCardTrigger",
  input: "Input",
  "input-group":
    "InputGroup InputGroupAddon InputGroupButton InputGroupTextarea",
  label: "Label",
  marker: "Marker MarkerContent MarkerIcon",
  message:
    "Message MessageAvatar MessageContent MessageFooter MessageGroup MessageHeader",
  "message-scroller":
    "MessageScroller MessageScrollerButton MessageScrollerContent MessageScrollerItem MessageScrollerProvider MessageScrollerViewport useMessageScroller useMessageScrollerScrollable useMessageScrollerVisibility",
  popover:
    "Popover PopoverContent PopoverDescription PopoverHeader PopoverTitle PopoverTrigger",
  "radio-group": "RadioGroup RadioGroupItem",
  select:
    "Select SelectContent SelectGroup SelectItem SelectTrigger SelectValue",
  slider: "Slider",
  spinner: "Spinner",
  tabs: "Tabs TabsList TabsTrigger",
  "toggle-group": "ToggleGroup ToggleGroupItem",
  tooltip: "Tooltip TooltipContent TooltipTrigger",
});
const f = ts.factory;
const id = (name) => f.createIdentifier(name);
const str = (value) => f.createStringLiteral(value);
const call = (name, args = [], types) =>
  f.createCallExpression(
    typeof name === "string" ? id(name) : name,
    types,
    args,
  );

/** Read-only TSX conversion. Unknown imports or React APIs are errors, not stubs. */
export function transformExample(code, filename = "example.tsx", options = {}) {
  const input = fixExampleInputs(code, filename);
  code = input.code;
  const asyncSource = adaptAsyncComponents(code, filename, 'solid');
  code = asyncSource.code;
  const file = ts.createSourceFile(
    filename,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const host = {
    getSourceFile: (name) => (name === filename ? file : undefined),
    getDefaultLibFileName: () => "",
    writeFile() {},
    getCurrentDirectory: () => "",
    getDirectories: () => [],
    fileExists: (name) => name === filename,
    readFile: (name) => (name === filename ? code : undefined),
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  const program = ts.createProgram(
    [filename],
    {
      noResolve: true,
      noLib: true,
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.Latest,
    },
    host,
  );
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(filename);
  const failure = (node, message) => {
    const point = source.getLineAndCharacterOfPosition(node.getStart(source));
    throw new Error(
      `${filename}:${point.line + 1}:${point.character + 1}: ${message}`,
    );
  };
  if (source.parseDiagnostics.length)
    failure(
      source,
      ts.flattenDiagnosticMessageText(
        source.parseDiagnostics[0].messageText,
        "\n",
      ),
    );
  const namespaces = new Set();
  const fragments = new Set();
  const loadingBoundaries = new Set();
  const erasedTypes = new Set();
  const sonnerBindings = new Set();
  const hooks = new Map();
  const translations = new Set();
  const replacementImports = new Map();
  const reactiveBindings = new Map();
  const stateOwners = new Map();
  const hookCalls = new Map();
  const refBindings = new Set();
  const derivedDeclarations = new Set();
  const parameterChanges = new Map();
  const reactiveImports = new Set();
  const stableImports = new Set();
  const stableCalls = new Set();
  const textInputImports = new Set();
  const propsObjects = new Set();
  const keyedMaps = new Map();
  const keyedExpressions = new Set();
  const reactiveReturns = new Set();
  const conditionalGuards = new Map();
  const guardedReturns = new Map();
  const variableChanges = new Map();
  const usedNames = new Set();
  const metadata = {
    inputFixes: input.fixes,
    keyedLists: 0,
    version: TRANSFORM_VERSION,
    filename,
    asyncComponents: asyncSource.components,
    imports: [],
    icons: { lucide: [], tabler: [] },
    hooks: [],
    derivedBindings: [],
    liveProps: [],
    unusedImports: [],
    conditionalReturns: 0,
    dynamicComponents: 0,
    renderProps: 0,
    translationAdapter: false,
    fragments: 0,
    erasedTypeImports: [],
    importAdapters: [],
    presetRoutes: [],
    unsupported: [],
  };
  const symbol = (node) => checker.getSymbolAtLocation(node);
  const usedImportBindings = new Set();
  function findImportUses(node) {
    if (ts.isTypeNode(node) || ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node)) {
      const target = ts.isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : symbol(node);
      if (target) usedImportBindings.add(target);
    }
    ts.forEachChild(node, findImportUses);
  }
  findImportUses(source);
  function collectNames(node) {
    if (ts.isIdentifier(node)) usedNames.add(node.text);
    ts.forEachChild(node, collectNames);
  }
  collectNames(source);
  function unique(base) {
    let name = base,
      index = 0;
    while (usedNames.has(name)) name = `${base}${++index}`;
    usedNames.add(name);
    return name;
  }
  const helperNames = new Map();
  const helper = (name) => {
    if (!helperNames.has(name)) helperNames.set(name, unique(`__docs_${name}`));
    return helperNames.get(name);
  };

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const module = statement.moduleSpecifier.text;
    let clause = statement.importClause;
    metadata.imports.push(module);
    if (!clause)
      failure(statement, `Side-effect import is not supported: ${module}`);
    if (clause.isTypeOnly) {
      if (clause.name) erasedTypes.add(symbol(clause.name));
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))
        erasedTypes.add(symbol(clause.namedBindings.name));
      else if (clause.namedBindings)
        for (const item of clause.namedBindings.elements)
          erasedTypes.add(symbol(item.name));
      metadata.erasedTypeImports.push(module);
      replacementImports.set(statement, null);
      continue;
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      const bindings = clause.namedBindings.elements.filter((item) => {
        if (!item.isTypeOnly) return true;
        erasedTypes.add(symbol(item.name));
        metadata.erasedTypeImports.push(
          `${module}:${item.propertyName?.text ?? item.name.text}`,
        );
        return false;
      });
      if (!clause.name && !bindings.length) {
        replacementImports.set(statement, null);
        continue;
      }
      clause = f.updateImportClause(
        clause,
        false,
        clause.name,
        f.updateNamedImports(clause.namedBindings, bindings),
      );
    }
    if (module !== "react") {
      const defaultName =
        clause.name && usedImportBindings.has(symbol(clause.name))
          ? clause.name
          : undefined;
      let named = clause.namedBindings;
      if (named && ts.isNamedImports(named)) {
        named = f.updateNamedImports(
          named,
          named.elements.filter((item) =>
            usedImportBindings.has(symbol(item.name)),
          ),
        );
        if (!named.elements.length) named = undefined;
      } else if (named && !usedImportBindings.has(symbol(named.name)))
        named = undefined;
      if (!defaultName && !named) {
        metadata.unusedImports.push(module);
        replacementImports.set(statement, null);
        continue;
      }
      clause = f.updateImportClause(clause, false, defaultName, named);
    }
    if (module === "react") {
      if (clause.name) namespaces.add(symbol(clause.name));
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings))
        namespaces.add(symbol(bindings.name));
      if (bindings && ts.isNamedImports(bindings))
        for (const item of bindings.elements) {
          const imported = item.propertyName?.text ?? item.name.text;
          if (imported === "Fragment") {
            fragments.add(symbol(item.name));
            continue;
          }
          if (imported === 'Suspense') { loadingBoundaries.add(symbol(item.name)); continue; }
          if (!SUPPORTED_REACT_HOOKS.includes(imported))
            failure(
              item,
              `Unsupported React import: ${imported}. Supported hooks: ${SUPPORTED_REACT_HOOKS.join(", ")}.`,
            );
          hooks.set(symbol(item.name), imported);
        }
      replacementImports.set(statement, null);
      continue;
    }
    let target;
    if (
      /\/(?:input|input-group|textarea)$/.test(module) &&
      clause.namedBindings &&
      ts.isNamedImports(clause.namedBindings)
    )
      for (const item of clause.namedBindings.elements)
        if (
          [
            "Input",
            "Textarea",
            "InputGroupInput",
            "InputGroupTextarea",
          ].includes(item.propertyName?.text ?? item.name.text)
        )
          textInputImports.add(symbol(item.name));
    if (/^@\/styles\/base-rhea\/ui\/[\w-]+$/.test(module)) {
      const component = module.split("/").at(-1);
      const allowed = Object.hasOwn(RHEA_NOVA_IMPORT_ROUTES, component)
        ? RHEA_NOVA_IMPORT_ROUTES[component].split(" ")
        : [];
      if (!allowed.length)
        failure(
          statement,
          `No checked Rhea-to-Nova native route for ${component}.`,
        );
      if (
        clause.name ||
        !clause.namedBindings ||
        !ts.isNamedImports(clause.namedBindings)
      )
        failure(
          statement,
          "The Rhea-to-Nova route requires checked named imports.",
        );
      for (const item of clause.namedBindings.elements) {
        const imported = item.propertyName?.text ?? item.name.text;
        if (!allowed.includes(imported))
          failure(
            item,
            `No checked Rhea-to-Nova native export: ${component}.${imported}.`,
          );
      }
      target = `@solid-cn/ui/${component}`;
      metadata.presetRoutes.push({
        source: module,
        target,
        sourcePreset: "base-rhea",
        targetPreset: "base-nova",
        presetEquivalent: false,
        comparison: "canonical-base-components-with-nova-styles",
      });
    } else if (
      /^@\/(?:styles\/base-nova\/ui(?:-rtl)?|components\/ui)\/[\w-]+$/.test(
        module,
      )
    )
      target = `@solid-cn/ui/${module.split("/").at(-1)}`;
    else if (/^@base-ui\/react(?:\/[\w-]+)?$/.test(module))
      target = module.replace("@base-ui/react", "@solid-cn/base-ui");
    else if (["@/lib/utils", "cn"].includes(module))
      target = "virtual:solid-doc-runtime";
    else if (/^date-fns(?:\/[\w-]+)?$/.test(module)) target = module;
    else if (module === "react-day-picker/locale") {
      // The pinned react-day-picker locale entry only re-exports this module.
      target = "date-fns/locale";
      metadata.importAdapters.push("react-day-picker/locale:date-fns/locale");
    } else if (module === "sonner") {
      if (
        clause.name ||
        !clause.namedBindings ||
        !ts.isNamedImports(clause.namedBindings)
      )
        failure(statement, "The native Sonner adapter requires named imports.");
      for (const item of clause.namedBindings.elements) {
        const imported = item.propertyName?.text ?? item.name.text;
        if (!["toast", "Toaster"].includes(imported))
          failure(
            item,
            `The native Sonner adapter does not implement ${imported}.`,
          );
        if (imported === "toast") sonnerBindings.add(symbol(item.name));
      }
      target = "@solid-cn/ui/sonner";
      metadata.importAdapters.push("sonner:existing-native-toast");
    } else if (
      module === "lucide-react" ||
      module === "@/registry/icons/__lucide__" ||
      module === "@tabler/icons-react"
    ) {
      const kind = module === "@tabler/icons-react" ? "tabler" : "lucide";
      if (
        clause.name ||
        !clause.namedBindings ||
        !ts.isNamedImports(clause.namedBindings)
      )
        failure(statement, `${module} requires named icon imports.`);
      for (const item of clause.namedBindings.elements) {
        if (item.isTypeOnly)
          failure(item, "Icon type imports are not supported.");
        metadata.icons[kind].push(item.propertyName?.text ?? item.name.text);
      }
      target = `virtual:solid-doc-icons/${kind}`;
    } else if (module === "@/components/language-selector") {
      const allowed = new Set([
        "useTranslation",
        "Translations",
        "LanguageProvider",
        "LanguageSelector",
        "Language",
        "Direction",
        "useLanguageContext",
        "languageOptions",
      ]);
      if (
        clause.name ||
        !clause.namedBindings ||
        !ts.isNamedImports(clause.namedBindings)
      )
        failure(statement, "The language adapter requires named imports.");
      for (const item of clause.namedBindings.elements) {
        const imported = item.propertyName?.text ?? item.name.text;
        if (!allowed.has(imported))
          failure(item, `Unsupported language helper: ${imported}`);
        if (imported === "useTranslation") translations.add(symbol(item.name));
      }
      metadata.translationAdapter = true;
      target = "virtual:solid-doc-language";
    } else if (options.importMap?.[module]) target = options.importMap[module];
    else {
      const importedNames = [
        ...(clause.name ? ["default"] : []),
        ...(clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)
          ? ["*"]
          : []),
        ...(clause.namedBindings && ts.isNamedImports(clause.namedBindings)
          ? clause.namedBindings.elements.map(
              (item) => item.propertyName?.text ?? item.name.text,
            )
          : []),
      ];
      const adapter = resolveExampleImport(module, importedNames);
      if (!adapter) failure(statement, `Unsupported import: ${module}`);
      target = adapter.target;
      metadata.importAdapters.push(adapter.id);
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings))
        for (const item of clause.namedBindings.elements) {
          if (
            adapter.reactiveExports?.includes(
              item.propertyName?.text ?? item.name.text,
            )
          )
            reactiveImports.add(symbol(item.name));
          if (
            adapter.stableExports?.includes(
              item.propertyName?.text ?? item.name.text,
            )
          )
            stableImports.add(symbol(item.name));
        }
    }
    replacementImports.set(
      statement,
      f.updateImportDeclaration(
        statement,
        statement.modifiers,
        clause,
        str(target),
        statement.attributes,
      ),
    );
  }
  const reactMember = (node) =>
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    namespaces.has(symbol(node.expression))
      ? node.name.text
      : ts.isIdentifier(node)
        ? hooks.get(symbol(node))
        : undefined;
  function enclosingFunction(node) {
    for (let parent = node.parent; parent; parent = parent.parent)
      if (ts.isFunctionLike(parent)) return parent;
    return undefined;
  }
  const isJsxTag = (node) =>
    (ts.isJsxOpeningElement(node.parent) ||
      ts.isJsxClosingElement(node.parent) ||
      ts.isJsxSelfClosingElement(node.parent)) &&
    node.parent.tagName === node;
  const isFragment = (node) =>
    (ts.isPropertyAccessExpression(node) &&
      namespaces.has(symbol(node.expression)) &&
      node.name.text === "Fragment") ||
    (ts.isIdentifier(node) && fragments.has(symbol(node)));
  const isLoadingBoundary = (node) => (ts.isPropertyAccessExpression(node) && namespaces.has(symbol(node.expression)) && node.name.text === 'Suspense') || (ts.isIdentifier(node) && loadingBoundaries.has(symbol(node)));
  const sonnerMethods = new Set([
    "success",
    "error",
    "warning",
    "info",
    "loading",
    "dismiss",
  ]);
  function componentFunction(node) {
    if (!ts.isFunctionLike(node)) return false;
    const name =
      node.name?.text ??
      (ts.isVariableDeclaration(node.parent)
        ? node.parent.name?.text
        : undefined);
    return (
      /^[A-Z]/.test(name ?? "") ||
      node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
      )
    );
  }
  function liveObjectBindings(pattern, object, owner) {
    const excluded = pattern.elements
      .filter((entry) => !entry.dotDotDotToken)
      .map((entry) => entry.propertyName?.text ?? entry.name.text);
    for (const entry of pattern.elements) {
      if (
        !ts.isIdentifier(entry.name) ||
        (entry.propertyName &&
          !ts.isIdentifier(entry.propertyName) &&
          !ts.isStringLiteral(entry.propertyName))
      )
        failure(
          entry,
          "Live destructuring supports named properties and a rest object only.",
        );
      const property = entry.propertyName?.text ?? entry.name.text;
      reactiveBindings.set(symbol(entry.name), () => {
        const value = entry.dotDotDotToken
          ? call(helper("omitProps"), [
              object(),
              f.createArrayLiteralExpression(excluded.map(str)),
            ])
          : property === 'className'
            ? f.createBinaryExpression(f.createElementAccessExpression(object(), str('class')), ts.SyntaxKind.QuestionQuestionToken, f.createElementAccessExpression(object(), str('className')))
            : f.createElementAccessExpression(object(), str(property));
        return entry.initializer
          ? f.createConditionalExpression(
              f.createBinaryExpression(
                value,
                ts.SyntaxKind.EqualsEqualsEqualsToken,
                id("undefined"),
              ),
              undefined,
              entry.initializer,
              undefined,
              value,
            )
          : value;
      });
      stateOwners.set(symbol(entry.name), owner);
    }
  }
  function scanParameters(node) {
    if (componentFunction(node) && node.parameters[0]) {
      const parameter = node.parameters[0];
      if (ts.isObjectBindingPattern(parameter.name)) {
        const holder = unique("__docs_props");
        parameterChanges.set(parameter, holder);
        liveObjectBindings(parameter.name, () => id(holder), node);
        metadata.liveProps.push(
          ...parameter.name.elements.map((entry) => entry.name.getText(source)),
        );
      } else if (ts.isIdentifier(parameter.name)) {
        // The Solid props object already has getters. Mark it as a reactive
        // source so derived local expressions are not frozen at setup.
        reactiveBindings.set(symbol(parameter.name), () =>
          id(parameter.name.text),
        );
        propsObjects.add(symbol(parameter.name));
        stateOwners.set(symbol(parameter.name), node);
      }
    }
    ts.forEachChild(node, scanParameters);
  }
  scanParameters(source);
  function scanKeyedMaps(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'map' && node.arguments.length === 1) {
      const callback = node.arguments[0];
      if (ts.isArrowFunction(callback) && callback.parameters.length >= 1 && callback.parameters.length <= 2 && callback.parameters.every(parameter => ts.isIdentifier(parameter.name))) {
        let returned = callback.body;
        if (ts.isBlock(returned)) returned = returned.statements.at(-1)?.expression;
        while (returned && ts.isParenthesizedExpression(returned)) returned = returned.expression;
        const keys = [];
        const collect = expression => {
          if (ts.isParenthesizedExpression(expression)) return collect(expression.expression);
          if (ts.isConditionalExpression(expression)) return collect(expression.whenTrue) && collect(expression.whenFalse);
          const opening = ts.isJsxElement(expression) ? expression.openingElement : ts.isJsxSelfClosingElement(expression) ? expression : undefined;
          const key = opening?.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.text === 'key')?.initializer;
          if (!key || !ts.isJsxExpression(key) || !key.expression) return false;
          keys.push(key.expression);
          return true;
        };
        if (returned && collect(returned) && keys.every(key => key.getText(source) === keys[0].getText(source))) {
          const key = keys[0];
          const row = callback.parameters[0].name;
          const index = callback.parameters[1]?.name;
          let keyRoot = key;
          while (ts.isPropertyAccessExpression(keyRoot) || ts.isElementAccessExpression(keyRoot)) keyRoot = keyRoot.expression;
          const byIndex = index && ts.isIdentifier(key) && symbol(key) === symbol(index);
          if (byIndex || ts.isIdentifier(keyRoot) && symbol(keyRoot) === symbol(row)) {
            keyedMaps.set(node, { callback, key, row, byIndex: !!byIndex });
            if (!ts.isBlock(callback.body)) keyedExpressions.add(callback.body);
            for (const [position, parameter] of callback.parameters.entries()) {
              if (byIndex && position === 1) continue;
              reactiveBindings.set(symbol(parameter.name), () => call(parameter.name.text));
              stateOwners.set(symbol(parameter.name), callback);
            }
            metadata.keyedLists++;
          }
        }
      }
    }
    ts.forEachChild(node, scanKeyedMaps);
  }
  scanKeyedMaps(source);
  function scan(node) {
    // Types are erased by the TSX compiler. Keeping their syntax is safe for
    // this runtime-only example transform; no React type declarations ship.
    if (ts.isTypeNode(node)) return;
    if (
      ts.isIdentifier(node) &&
      erasedTypes.has(symbol(node)) &&
      !ts.isImportSpecifier(node.parent) &&
      !ts.isImportClause(node.parent) &&
      !ts.isNamespaceImport(node.parent)
    )
      failure(node, "A type-only import cannot be used as a runtime value.");
    if (
      ts.isIdentifier(node) &&
      fragments.has(symbol(node)) &&
      !ts.isImportSpecifier(node.parent) &&
      !isJsxTag(node)
    )
      failure(node, "Fragment is supported as a JSX tag only.");
    if (ts.isIdentifier(node) && namespaces.has(symbol(node))) {
      const parent = node.parent;
      const imported =
        ts.isNamespaceImport(parent) || ts.isImportClause(parent);
      const supportedCall =
        ts.isPropertyAccessExpression(parent) &&
        parent.expression === node &&
        ts.isCallExpression(parent.parent) &&
        parent.parent.expression === parent &&
        SUPPORTED_REACT_HOOKS.includes(parent.name.text);
      const supportedFragment =
        ts.isPropertyAccessExpression(parent) &&
        isFragment(parent) &&
        isJsxTag(parent);
      const supportedLoading = ts.isPropertyAccessExpression(parent) && isLoadingBoundary(parent) && isJsxTag(parent);
      if (!imported && !supportedCall && !supportedFragment && !supportedLoading)
        failure(
          node,
          "React namespace values, type references, spreads, and indirect hook aliases require an explicit transform.",
        );
    }
    if (
      ts.isIdentifier(node) &&
      hooks.has(symbol(node)) &&
      !ts.isImportSpecifier(node.parent) &&
      !(ts.isCallExpression(node.parent) && node.parent.expression === node)
    )
      failure(
        node,
        "A React hook alias must be called directly, not copied or passed as a value.",
      );
    if (
      ts.isPropertyAccessExpression(node) &&
      namespaces.has(symbol(node.expression)) &&
      !SUPPORTED_REACT_HOOKS.includes(node.name.text) &&
      !((isFragment(node) || isLoadingBoundary(node)) && isJsxTag(node))
    )
      failure(node, `Unsupported React API: ${node.name.text}`);
    if (
      ts.isIdentifier(node) &&
      sonnerBindings.has(symbol(node)) &&
      !ts.isImportSpecifier(node.parent)
    ) {
      const parent = node.parent;
      const direct = ts.isCallExpression(parent) && parent.expression === node;
      const method =
        ts.isPropertyAccessExpression(parent) &&
        parent.expression === node &&
        sonnerMethods.has(parent.name.text) &&
        ts.isCallExpression(parent.parent) &&
        parent.parent.expression === parent;
      if (!direct && !method)
        failure(
          node,
          "Unsupported Sonner API. Only direct native toast calls and its supported status methods are mapped.",
        );
      const invocation = direct ? parent : parent.parent;
      if (invocation.arguments.length > 2)
        failure(
          invocation,
          "Native toast accepts a message and one options object.",
        );
      if (invocation.arguments[1]) {
        const options = invocation.arguments[1];
        if (!ts.isObjectLiteralExpression(options))
          failure(options, "Native toast options must be an explicit object.");
        for (const property of options.properties)
          if (
            (!ts.isPropertyAssignment(property) &&
              !ts.isShorthandPropertyAssignment(property)) ||
            !["description", "duration", "id", "action"].includes(
              property.name?.text,
            )
          )
            failure(
              property,
              "This Sonner toast option has no supported native mapping.",
            );
      }
    }
    if (ts.isCallExpression(node) && reactMember(node.expression)) {
      const name = reactMember(node.expression);
      const parent = node.parent;
      const owner = enclosingFunction(node);
      if (
        !owner ||
        (!componentFunction(owner) && !/^use[A-Z]/.test(owner.name?.text ?? ""))
      )
        failure(
          node,
          "Hooks must belong to a component or a named custom hook, not an event or memo callback.",
        );
      for (
        let ancestor = node.parent;
        ancestor && ancestor !== owner;
        ancestor = ancestor.parent
      )
        if (
          ts.isIfStatement(ancestor) ||
          ts.isConditionalExpression(ancestor) ||
          ts.isIterationStatement(ancestor, false) ||
          ts.isSwitchStatement(ancestor)
        )
          failure(
            node,
            "Conditional hooks and hooks in loops are not supported.",
          );
      let statement = node;
      while (statement.parent && !ts.isBlock(statement.parent))
        statement = statement.parent;
      if (!owner || statement.parent !== owner.body)
        failure(
          node,
          "Hooks must be called directly in a component body, not in a condition or loop.",
        );
      hookCalls.set(node, name);
      if (name === "useState") {
        if (
          !ts.isVariableDeclaration(parent) ||
          !ts.isArrayBindingPattern(parent.name) ||
          parent.name.elements.length < 1 ||
          parent.name.elements.length > 2 ||
          parent.name.elements.some(
            (element) =>
              !ts.isOmittedExpression(element) &&
              (!ts.isBindingElement(element) ||
                !ts.isIdentifier(element.name) ||
                element.dotDotDotToken ||
                element.initializer),
          )
        )
          failure(
            node,
            "useState must bind its value and setter to identifiers. Either entry may be omitted.",
          );
        if (node.arguments.length > 1)
          failure(node, "useState accepts one initializer.");
        const value = parent.name.elements[0];
        if (ts.isBindingElement(value)) {
          reactiveBindings.set(symbol(value.name), () => call(value.name.text));
          stateOwners.set(symbol(value.name), owner);
        }
        metadata.hooks.push({
          hook: name,
          binding: ts.isBindingElement(value) ? value.name.text : undefined,
        });
      } else {
        if (
          ["useEffect", "useLayoutEffect", "useMemo", "useCallback"].includes(
            name,
          )
        ) {
          const [callback, dependencies] = node.arguments;
          if (
            node.arguments.length !== 2 ||
            !callback ||
            (!ts.isArrowFunction(callback) &&
              !ts.isFunctionExpression(callback)) ||
            !dependencies ||
            !ts.isArrayLiteralExpression(dependencies) ||
            dependencies.elements.some(ts.isSpreadElement)
          )
            failure(
              node,
              `${name} requires an inline callback and an explicit fixed dependency array.`,
            );
          if (
            callback.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
            )
          )
            failure(callback, `${name} does not support an async callback.`);
          if (name !== "useCallback" && callback.parameters.length)
            failure(callback, `${name} callbacks must have no parameters.`);
          if (
            ["useEffect", "useLayoutEffect"].includes(name) &&
            !ts.isExpressionStatement(parent)
          )
            failure(node, `${name} must be a standalone call.`);
        }
        if (["useMemo", "useCallback", "useId", "useRef"].includes(name)) {
          if (
            !ts.isVariableDeclaration(parent) ||
            !ts.isIdentifier(parent.name)
          )
            failure(node, `${name} must bind one identifier.`);
          if (["useMemo", "useCallback"].includes(name)) {
            reactiveBindings.set(symbol(parent.name), () =>
              call(parent.name.text),
            );
            stateOwners.set(symbol(parent.name), owner);
          }
          if (name === "useRef") {
            if (node.arguments.length !== 1)
              failure(node, "useRef requires one initial value.");
            refBindings.add(symbol(parent.name));
          }
          if (name === "useId" && node.arguments.length)
            failure(node, "useId accepts no arguments.");
        }
        metadata.hooks.push({
          hook: name,
          binding: ts.isVariableDeclaration(parent)
            ? parent.name.getText(source)
            : undefined,
        });
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      reactiveImports.has(symbol(node.initializer.expression))
    ) {
      reactiveBindings.set(symbol(node.name), () => call(node.name.text));
      stateOwners.set(symbol(node.name), enclosingFunction(node));
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      (translations.has(symbol(node.initializer.expression)) ||
        (enclosingFunction(node) &&
          !reactMember(node.initializer.expression) &&
          ts.isVariableStatement(node.parent.parent) &&
          node.parent.parent.parent === enclosingFunction(node).body))
    ) {
      const name = unique("__docs_translation");
      variableChanges.set(node, name);
      liveObjectBindings(node.name, () => id(name), enclosingFunction(node));
    }
    ts.forEachChild(node, scan);
  }
  scan(source);
  function isDeclarationName(node) {
    const parent = node.parent;
    return (
      ((ts.isBindingElement(parent) ||
        ts.isVariableDeclaration(parent) ||
        ts.isParameter(parent) ||
        ts.isFunctionDeclaration(parent) ||
        ts.isImportSpecifier(parent) ||
        ts.isImportClause(parent)) &&
        parent.name === node) ||
      (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
      (ts.isPropertyAssignment(parent) && parent.name === node) ||
      ts.isJsxAttribute(parent) ||
      ts.isImportSpecifier(parent) ||
      ts.isExportSpecifier(parent) ||
      ts.isQualifiedName(parent)
    );
  }
  const findStableCalls = (node) => {
    if (ts.isCallExpression(node) && stableImports.has(symbol(node.expression)))
      stableCalls.add(node);
    ts.forEachChild(node, findStableCalls);
  };
  findStableCalls(source);
  let foundDerived;
  do {
    foundDerived = false;
    const findDerived = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        !derivedDeclarations.has(node) &&
        !reactiveBindings.has(symbol(node.name)) &&
        !hookCalls.has(node.initializer) &&
        !stableCalls.has(node.initializer)
      ) {
        const owner = enclosingFunction(node);
        const topLevel =
          owner &&
          ts.isVariableStatement(node.parent.parent) &&
          node.parent.parent.parent === owner.body;
        let dependent = false;
        const findRead = (child) => {
          if (ts.isTypeNode(child) || ts.isFunctionLike(child)) return;
          if (ts.isIdentifier(child) && !isDeclarationName(child)) {
            const target = ts.isShorthandPropertyAssignment(child.parent)
              ? checker.getShorthandAssignmentValueSymbol(child.parent)
              : symbol(child);
            if (
              stateOwners.get(target) === owner &&
              reactiveBindings.has(target)
            )
              dependent = true;
          }
          ts.forEachChild(child, findRead);
        };
        if (topLevel) findRead(node.initializer);
        if (dependent) {
          if (!(node.parent.flags & ts.NodeFlags.Const))
            failure(
              node,
              "Reactive local values must use const. Mutable setup bindings need an explicit transform.",
            );
          derivedDeclarations.add(node);
          reactiveBindings.set(symbol(node.name), () => call(node.name.text));
          stateOwners.set(symbol(node.name), owner);
          metadata.derivedBindings.push(node.name.text);
          foundDerived = true;
        }
      }
      ts.forEachChild(node, findDerived);
    };
    findDerived(source);
  } while (foundDerived);
  function isDynamicTag(tag) {
    let root = tag;
    while (ts.isPropertyAccessExpression(root)) root = root.expression;
    return ts.isIdentifier(root) && reactiveBindings.has(symbol(root));
  }
  function scanReturns(node) {
    if (componentFunction(node) && ts.isBlock(node.body)) {
      const statements = node.body.statements;
      const final = statements.at(-1);
      let guardIndex = statements.length - 2;
      // A derived const only creates a lazy memo. It is safe to place the
      // preceding guard in the final reactive return without evaluating it.
      while (
        guardIndex >= 0 &&
        ts.isVariableStatement(statements[guardIndex]) &&
        statements[guardIndex].declarationList.declarations.every((item) =>
          derivedDeclarations.has(item),
        )
      )
        guardIndex--;
      const guard = statements[guardIndex];
      if (final && ts.isReturnStatement(final) && final.expression) {
        const branch =
          guard && ts.isIfStatement(guard) && !guard.elseStatement
            ? ts.isBlock(guard.thenStatement) &&
              guard.thenStatement.statements.length === 1
              ? guard.thenStatement.statements[0]
              : guard.thenStatement
            : undefined;
        if (branch && ts.isReturnStatement(branch)) {
          conditionalGuards.set(guard, final);
          guardedReturns.set(final, {
            condition: guard.expression,
            whenTrue: branch.expression ?? f.createNull(),
          });
          metadata.conditionalReturns++;
        }
      }
      for (const statement of statements) {
        if (!ts.isReturnStatement(statement) || !statement.expression) continue;
        let expression = statement.expression;
        while (ts.isParenthesizedExpression(expression))
          expression = expression.expression;
        if (
          !ts.isJsxElement(expression) &&
          !ts.isJsxSelfClosingElement(expression) &&
          !ts.isJsxFragment(expression)
        ) {
          let dependent = false;
          const findRead = (child) => {
            if (ts.isFunctionLike(child) || ts.isTypeNode(child)) return;
            if (
              ts.isIdentifier(child) &&
              !isDeclarationName(child) &&
              reactiveBindings.has(symbol(child))
            )
              dependent = true;
            ts.forEachChild(child, findRead);
          };
          findRead(expression);
          if (dependent) reactiveReturns.add(statement);
        }
      }
    }
    ts.forEachChild(node, scanReturns);
  }
  scanReturns(source);
  function validateStateReads(node) {
    if (ts.isTypeNode(node)) return;
    if (ts.isIdentifier(node) && !isDeclarationName(node)) {
      const target = ts.isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : symbol(node);
      if (stateOwners.has(target)) {
        const owner = stateOwners.get(target);
        let allowed = false;
        for (
          let parent = node.parent;
          parent && parent !== owner;
          parent = parent.parent
        ) {
          // JSX expressions are compiled as reactive reads. A nested function
          // reads the accessor when called, rather than at component setup.
          if (
            ts.isJsxExpression(parent) ||
            ts.isJsxSpreadAttribute(parent) ||
            ts.isFunctionLike(parent) ||
            derivedDeclarations.has(parent) ||
            hookCalls.has(parent) ||
            stableCalls.has(parent) ||
            variableChanges.has(parent) ||
            conditionalGuards.has(parent) ||
            reactiveReturns.has(parent) ||
            keyedExpressions.has(parent) ||
            ((ts.isJsxOpeningElement(parent) ||
              ts.isJsxSelfClosingElement(parent) ||
              ts.isJsxClosingElement(parent)) &&
              isDynamicTag(parent.tagName))
          ) {
            allowed = true;
            break;
          }
        }
        if (!allowed)
          failure(
            node,
            `State "${node.text}" is read during component setup outside a supported derived const, hook, or JSX expression. Imperative setup reads and conditional returns need an explicit reactive transform.`,
          );
      }
    }
    ts.forEachChild(node, validateStateReads);
  }
  validateStateReads(source);
  const result = ts.transform(source, [
    (context) => {
      let snapshots = new Map();
      const arrow = (body) =>
        f.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          body,
        );
      function callbackFactory(callback) {
        const captured = new Map();
        const capturedProps = new Map();
        const findReads = (node) => {
          if (ts.isTypeNode(node)) return;
          if (ts.isIdentifier(node) && !isDeclarationName(node)) {
            const target = ts.isShorthandPropertyAssignment(node.parent)
              ? checker.getShorthandAssignmentValueSymbol(node.parent)
              : symbol(node);
            if (
              reactiveBindings.has(target) &&
              stateOwners.get(target) !== callback
            ) {
              captured.set(
                target,
                captured.get(target) ?? unique(`__docs_snapshot_${node.text}`),
              );
              if (propsObjects.has(target)) {
                const parent = node.parent;
                const property =
                  ts.isPropertyAccessExpression(parent) &&
                  parent.expression === node
                    ? parent.name.text
                    : ts.isElementAccessExpression(parent) &&
                        parent.expression === node &&
                        ts.isStringLiteral(parent.argumentExpression)
                      ? parent.argumentExpression.text
                      : undefined;
                if (!property)
                  failure(
                    node,
                    "A hook callback must read explicit props fields. Passing the live props object as a value would lose React closure snapshots.",
                  );
                if (!capturedProps.has(target))
                  capturedProps.set(target, new Set());
                capturedProps.get(target).add(property);
              }
            }
          }
          ts.forEachChild(node, findReads);
        };
        findReads(callback);
        const declarations = [...captured].map(([target, name]) =>
          f.createVariableStatement(
            undefined,
            f.createVariableDeclarationList(
              [
                f.createVariableDeclaration(
                  id(name),
                  undefined,
                  undefined,
                  capturedProps.has(target)
                    ? f.createObjectLiteralExpression(
                        [...capturedProps.get(target)].map((property) =>
                          f.createPropertyAssignment(
                            str(property),
                            f.createElementAccessExpression(
                              reactiveBindings.get(target)(),
                              str(property),
                            ),
                          ),
                        ),
                      )
                    : reactiveBindings.get(target)(),
                ),
              ],
              ts.NodeFlags.Const,
            ),
          ),
        );
        const previous = snapshots;
        snapshots = new Map([...previous, ...captured]);
        const body = ts.visitNode(callback, visit);
        snapshots = previous;
        return arrow(
          f.createBlock([...declarations, f.createReturnStatement(body)], true),
        );
      }
      const visitChildren = (children) =>
        children.flatMap((child) => {
          const updated = ts.visitNode(child, visit);
          return !updated
            ? []
            : ts.isJsxFragment(updated)
              ? [...updated.children]
              : [updated];
        });
      const visit = (node) => {
        if (ts.isTypeNode(node)) return node;
        if (keyedMaps.has(node)) {
          const { callback, key, row, byIndex } = keyedMaps.get(node);
          const tag = id(helper('DocFor'));
          const keyValue = byIndex ? f.createFalse() : f.createArrowFunction(undefined, undefined, [f.createParameterDeclaration(undefined, undefined, row)], undefined, f.createToken(ts.SyntaxKind.EqualsGreaterThanToken), key);
          return f.createJsxElement(
            f.createJsxOpeningElement(tag, undefined, f.createJsxAttributes([
              f.createJsxAttribute(id('each'), f.createJsxExpression(undefined, ts.visitNode(node.expression.expression, visit))),
              f.createJsxAttribute(id('keyed'), f.createJsxExpression(undefined, keyValue)),
            ])),
            [f.createJsxExpression(undefined, !ts.isBlock(callback.body)
              ? f.updateArrowFunction(callback, callback.modifiers, callback.typeParameters, callback.parameters, callback.type, callback.equalsGreaterThanToken,
                  f.createJsxFragment(f.createJsxOpeningFragment(), [f.createJsxExpression(undefined, ts.visitNode(callback.body, visit))], f.createJsxJsxClosingFragment()))
              : ts.visitNode(callback, visit))],
            f.createJsxClosingElement(tag),
          );
        }
        if (ts.isPropertyAccessExpression(node) && node.name.text === 'className' && propsObjects.has(symbol(node.expression)))
          return f.createBinaryExpression(f.createPropertyAccessExpression(ts.visitNode(node.expression, visit), 'class'), ts.SyntaxKind.QuestionQuestionToken, node);
        if (stableCalls.has(node)) {
          const liveArgument = (value) =>
            ts.isObjectLiteralExpression(value)
              ? f.updateObjectLiteralExpression(
                  value,
                  value.properties.map((property) => {
                    if (
                      ts.isPropertyAssignment(property) ||
                      ts.isShorthandPropertyAssignment(property)
                    ) {
                      const expression = ts.isShorthandPropertyAssignment(
                        property,
                      )
                        ? (visit(property).initializer ??
                          ts.visitNode(property.name, visit))
                        : liveArgument(property.initializer);
                      return f.createGetAccessorDeclaration(
                        undefined,
                        property.name,
                        [],
                        undefined,
                        f.createBlock([f.createReturnStatement(expression)]),
                      );
                    }
                    return ts.visitNode(property, visit);
                  }),
                )
              : ts.visitNode(value, visit);
          return f.updateCallExpression(
            node,
            node.expression,
            node.typeArguments,
            node.arguments.map(liveArgument),
          );
        }
        if (conditionalGuards.has(node)) return undefined;
        if (guardedReturns.has(node) || reactiveReturns.has(node)) {
          const guard = guardedReturns.get(node);
          const expression = guard
            ? f.createConditionalExpression(
                ts.visitNode(guard.condition, visit),
                undefined,
                ts.visitNode(guard.whenTrue, visit),
                undefined,
                ts.visitNode(node.expression, visit),
              )
            : ts.visitNode(node.expression, visit);
          return f.updateReturnStatement(
            node,
            f.createJsxFragment(
              f.createJsxOpeningFragment(),
              [f.createJsxExpression(undefined, expression)],
              f.createJsxJsxClosingFragment(),
            ),
          );
        }
        if (ts.isParameter(node) && parameterChanges.has(node))
          return f.updateParameterDeclaration(
            node,
            node.modifiers,
            node.dotDotDotToken,
            id(parameterChanges.get(node)),
            node.questionToken,
            node.type,
            node.initializer,
          );
        if (ts.isImportDeclaration(node)) return replacementImports.get(node);
        if (isLoadingBoundary(node) && isJsxTag(node)) return id(helper('DocLoading'));
        if (
          ts.isExpressionStatement(node) &&
          ts.isStringLiteral(node.expression) &&
          node.expression.text === "use client"
        )
          return undefined;
        if (
          (ts.isJsxElement(node) && isFragment(node.openingElement.tagName)) ||
          (ts.isJsxSelfClosingElement(node) && isFragment(node.tagName))
        ) {
          const opening = ts.isJsxElement(node) ? node.openingElement : node;
          for (const attribute of opening.attributes.properties)
            if (!ts.isJsxAttribute(attribute) || attribute.name.text !== "key")
              failure(
                attribute,
                "Fragment supports only the key attribute in this native example transform.",
              );
          metadata.fragments++;
          return f.createJsxFragment(
            f.createJsxOpeningFragment(),
            ts.isJsxElement(node) ? visitChildren(node.children) : [],
            f.createJsxJsxClosingFragment(),
          );
        }
        if (ts.isJsxFragment(node))
          return f.updateJsxFragment(
            node,
            node.openingFragment,
            visitChildren(node.children),
            node.closingFragment,
          );
        if (
          (ts.isJsxElement(node) &&
            isDynamicTag(node.openingElement.tagName)) ||
          (ts.isJsxSelfClosingElement(node) && isDynamicTag(node.tagName))
        ) {
          metadata.dynamicComponents++;
          const opening = ts.isJsxElement(node) ? node.openingElement : node;
          const name = id(helper("DocDynamic"));
          const attributes = f.createJsxAttributes([
            ...opening.attributes.properties
              .map((attribute) => ts.visitNode(attribute, visit))
              .filter(Boolean),
            f.createJsxAttribute(
              id("component"),
              f.createJsxExpression(
                undefined,
                ts.visitNode(opening.tagName, visit),
              ),
            ),
          ]);
          return ts.isJsxSelfClosingElement(node)
            ? f.updateJsxSelfClosingElement(node, name, undefined, attributes)
            : f.updateJsxElement(
                node,
                f.updateJsxOpeningElement(opening, name, undefined, attributes),
                visitChildren(node.children),
                f.updateJsxClosingElement(node.closingElement, name),
              );
        }
        if (ts.isJsxElement(node))
          return f.updateJsxElement(
            node,
            ts.visitNode(node.openingElement, visit),
            visitChildren(node.children),
            ts.visitNode(node.closingElement, visit),
          );
        if (hookCalls.has(node) && hookCalls.get(node) === "useState")
          return call(
            helper("createDocState"),
            node.arguments.length
              ? node.arguments.map((argument) => ts.visitNode(argument, visit))
              : [id("undefined")],
            node.typeArguments,
          );
        if (hookCalls.has(node)) {
          const name = hookCalls.get(node);
          if (name === "useId") return call(helper("createDocId"));
          if (name === "useRef")
            return call(
              helper("createDocRef"),
              node.arguments.map((argument) => ts.visitNode(argument, visit)),
              node.typeArguments,
            );
          const helpers = {
            useEffect: "createDocEffect",
            useLayoutEffect: "createDocLayoutEffect",
            useMemo: "createDocMemo",
            useCallback: "createDocCallback",
          };
          return call(
            helper(helpers[name]),
            [
              arrow(ts.visitNode(node.arguments[1], visit)),
              callbackFactory(node.arguments[0]),
            ],
            node.typeArguments,
          );
        }
        if (ts.isVariableDeclaration(node) && derivedDeclarations.has(node))
          return f.updateVariableDeclaration(
            node,
            node.name,
            node.exclamationToken,
            undefined,
            call(helper("createDocDerived"), [
              arrow(ts.visitNode(node.initializer, visit)),
            ]),
          );
        if (ts.isVariableDeclaration(node) && variableChanges.has(node))
          return f.updateVariableDeclaration(
            node,
            id(variableChanges.get(node)),
            node.exclamationToken,
            undefined,
            ts.visitNode(node.initializer, visit),
          );
        if (ts.isShorthandPropertyAssignment(node)) {
          const target = checker.getShorthandAssignmentValueSymbol(node);
          if (snapshots.has(target))
            return f.createPropertyAssignment(
              node.name,
              id(snapshots.get(target)),
            );
          if (reactiveBindings.has(target))
            return f.createPropertyAssignment(
              node.name,
              reactiveBindings.get(target)(),
            );
        }
        if (ts.isIdentifier(node) && !isDeclarationName(node)) {
          if (snapshots.has(symbol(node)))
            return id(snapshots.get(symbol(node)));
          if (reactiveBindings.has(symbol(node)))
            return reactiveBindings.get(symbol(node))();
        }
        if (ts.isJsxAttribute(node)) {
          const name = node.name.getText(source);
          if (name === "key") return undefined;
          if (
            name === "ref" &&
            node.initializer &&
            ts.isJsxExpression(node.initializer) &&
            ts.isIdentifier(node.initializer.expression) &&
            refBindings.has(symbol(node.initializer.expression))
          )
            return f.updateJsxAttribute(
              node,
              node.name,
              f.createJsxExpression(
                undefined,
                call(helper("docRef"), [node.initializer.expression]),
              ),
            );
          if (
            name === "render" &&
            node.initializer &&
            ts.isJsxExpression(node.initializer)
          ) {
            const element = node.initializer.expression;
            if (
              element &&
              (ts.isArrowFunction(element) || ts.isFunctionExpression(element))
            ) {
              if (
                element.parameters.some(
                  (parameter) => !ts.isIdentifier(parameter.name),
                )
              )
                failure(
                  element,
                  "Render callback parameters must be identifiers to retain live Solid props.",
                );
              metadata.renderProps++;
              return f.updateJsxAttribute(
                node,
                node.name,
                f.createJsxExpression(undefined, ts.visitNode(element, visit)),
              );
            }
            if (
              !element ||
              (!ts.isJsxElement(element) &&
                !ts.isJsxSelfClosingElement(element))
            )
              failure(
                node,
                "render must be a JSX element. Functions require an explicit native example.",
              );
            metadata.renderProps++;
            const parameter = unique("__docs_renderProps");
            const opening = ts.isJsxElement(element)
              ? element.openingElement
              : element;
            const merged = [id(parameter)];
            for (const attribute of opening.attributes.properties) {
              if (ts.isJsxSpreadAttribute(attribute)) {
                merged.push(ts.visitNode(attribute.expression, visit));
                continue;
              }
              const translated = visit(attribute);
              if (!translated) continue;
              const key = translated.name.text;
              const expression = translated.initializer
                ? ts.isStringLiteral(translated.initializer)
                  ? translated.initializer
                  : (translated.initializer.expression ?? f.createTrue())
                : f.createTrue();
              merged.push(
                f.createObjectLiteralExpression([
                  f.createGetAccessorDeclaration(
                    undefined,
                    str(key),
                    [],
                    undefined,
                    f.createBlock([f.createReturnStatement(expression)]),
                  ),
                ]),
              );
            }
            const attributes = f.createJsxAttributes([
              f.createJsxSpreadAttribute(
                call(helper("mergeRenderProps"), merged),
              ),
            ]);
            const body = ts.isJsxSelfClosingElement(element)
              ? f.updateJsxSelfClosingElement(
                  element,
                  opening.tagName,
                  opening.typeArguments,
                  attributes,
                )
              : f.updateJsxElement(
                  element,
                  f.updateJsxOpeningElement(
                    opening,
                    opening.tagName,
                    opening.typeArguments,
                    attributes,
                  ),
                  visitChildren(element.children),
                  element.closingElement,
                );
            return f.updateJsxAttribute(
              node,
              node.name,
              f.createJsxExpression(
                undefined,
                f.createArrowFunction(
                  undefined,
                  undefined,
                  [
                    f.createParameterDeclaration(
                      undefined,
                      undefined,
                      id(parameter),
                    ),
                  ],
                  undefined,
                  f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                  body,
                ),
              ),
            );
          }
          const tagName = node.parent.parent.tagName;
          const intrinsic = ts.isIdentifier(tagName) && /^[a-z]/.test(tagName.text);
          const renamed =
            name === "onChange" &&
            (() => {
              const tag = node.parent.parent.tagName;
              return (
                ts.isIdentifier(tag) &&
                (["input", "textarea"].includes(tag.text) ||
                  textInputImports.has(symbol(tag)))
              );
            })()
              ? "onInput"
              : name === "className"
                ? "class"
                : name === "htmlFor"
                  ? "for"
                  : name === "tabIndex"
                    ? "tabindex"
                    : intrinsic ? svgAttributeAliases.get(name) ?? name : name;
          let initializer = node.initializer
            ? ts.visitNode(node.initializer, visit)
            : undefined;
          if (/^(?:data-|aria-)/.test(name) && !initializer)
            initializer = str("true");
          if (
            /^(?:data-|aria-)/.test(name) &&
            initializer &&
            ts.isJsxExpression(initializer) &&
            initializer.expression
          )
            initializer = f.createJsxExpression(
              undefined,
              call(helper("docAttribute"), [initializer.expression]),
            );
          return f.updateJsxAttribute(node, id(renamed), initializer);
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit);
    },
  ]);
  const transformed = result.transformed[0];
  const imports = helperNames.size
    ? [
        f.createImportDeclaration(
          undefined,
          f.createImportClause(
            false,
            undefined,
            f.createNamedImports(
              [...helperNames].map(([imported, local]) =>
                f.createImportSpecifier(false, id(imported), id(local)),
              ),
            ),
          ),
          str("virtual:solid-doc-runtime"),
        ),
      ]
    : [];
  const output = ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed })
    .printFile(
      f.updateSourceFile(transformed, [...imports, ...transformed.statements]),
    );
  result.dispose();
  if (/\bfrom\s+['"]react(?:\/|['"])/.test(output))
    throw new Error(
      `${filename}: React runtime import remains after transformation.`,
    );
  return { code: output, map: null, metadata };
}
