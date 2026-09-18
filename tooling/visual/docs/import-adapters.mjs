const adapters = {
  'react-day-picker': ['day-picker', ['DayPicker', 'getDefaultClassNames']],
  'react-day-picker/persian': ['day-picker-persian', ['DayPicker', 'faIR', 'enUS']],
  '@solid-cn/docs/async': ['async', ['useAsync'], ['useAsync']],
  "@ai-sdk/react": ["ai-sdk", ["useChat", "Chat"]],
  "@tanstack/ai-react": ["ai-tanstack", ["useChat"]],
  "@/components/message-animated": ["message-animated", ["MessageAnimated"]],
  "@/components/markdown": ["markdown", ["Markdown"]],
  "@/registry/new-york-v4/ui/chart": [
    "new-york-chart",
    ["ChartContainer", "ChartTooltip", "ChartTooltipContent"],
  ],
  "next/link": ["next-link", ["default"]],
  "next/image": ["next-image", ["default"]],
  "react-textarea-autosize": ["textarea-autosize", ["default"]],
  "@/hooks/use-mobile": ["environment", ["useIsMobile"], ["useIsMobile"]],
  "@/hooks/use-media-query": [
    "environment",
    ["useMediaQuery"],
    ["useMediaQuery"],
  ],
  "@/hooks/use-copy-to-clipboard": ["environment", ["useCopyToClipboard"]],
  "input-otp": [
    "otp-patterns",
    ["REGEXP_ONLY_CHARS", "REGEXP_ONLY_DIGITS", "REGEXP_ONLY_DIGITS_AND_CHARS"],
  ],
  "@tanstack/react-table": [
    "table",
    [
      "columnFilteringFeature",
      "columnVisibilityFeature",
      "createColumnHelper",
      "createFilteredRowModel",
      "createPaginatedRowModel",
      "createSortedRowModel",
      "filterFn_includesString",
      "rowPaginationFeature",
      "rowSelectionFeature",
      "rowSortingFeature",
      "sortFn_alphanumeric",
      "sortFn_text",
      "tableFeatures",
      "useTable",
    ],
  ],
};
const pure = {
  zod: ["z", "ZodError", "*"],
  "chrono-node": ["parse", "parseDate", "casual", "strict", "*"],
  "embla-carousel-autoplay": ["default"],
  "@/lib/ai": ["createChat", "getMessageText"],
  "@/lib/message-animations": ["MESSAGE_ANIMATIONS"],
  "@shadcn/helpers/ai-sdk": ["createChat", "createMessage"],
  "@shadcn/helpers/tanstack-ai": ["createChat", "createMessage"],
  "next/font/google": ["Vazirmatn"],
};

export function resolveExampleImport(module, importedNames) {
  if (module === "@/registry/new-york-v4/ui/card") {
    const allowed = [
      "Card",
      "CardHeader",
      "CardFooter",
      "CardTitle",
      "CardAction",
      "CardDescription",
      "CardContent",
    ];
    if (importedNames.some((name) => !allowed.includes(name)))
      throw new Error("Unsupported New York Card export");
    return {
      target: "virtual:solid-doc-source/new-york-card",
      id: "new-york-card:original-source-transform",
    };
  }
  if (module === "recharts") {
    const names = ["Bar", "BarChart", "CartesianGrid", "XAxis"];
    for (const name of importedNames)
      if (!names.includes(name))
        throw new Error(`Unsupported native chart export: ${name}`);
    return {
      target: "@solid-cn/ui/chart",
      id: "recharts:existing-native-chart",
      reactiveExports: [],
    };
  }
  const entry = adapters[module];
  const allowed = entry?.[1] ?? pure[module];
  if (!allowed) return undefined;
  for (const name of importedNames)
    if (!allowed.includes(name))
      throw new Error(`Unsupported native adapter export: ${module}:${name}`);
  return {
    target: entry ? `virtual:solid-doc-adapter/${entry[0]}` : module,
    id: entry
      ? `${module}:native-${entry[0]}`
      : `${module}:original-framework-independent-code`,
    reactiveExports: entry?.[2] ?? [],
    stableExports: ["useTable", "useChat", "useCopyToClipboard"].filter(
      (name) => importedNames.includes(name),
    ),
  };
}
