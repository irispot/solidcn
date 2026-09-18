import { createContext, createSignal, useContext } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../../shadcn-ui/packages/solid/src/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shadcn-ui/packages/solid/src/select";

// Explicit native equivalent of the original documentation language context.
// The example's translations remain in the original, unchanged example file.
export type Language = "en" | "ar" | "he";
export type Direction = "ltr" | "rtl";
export type Translations<
  T extends Record<string, string> = Record<string, string>,
> = Record<Language, { dir: Direction; locale?: string; values: T }>;
type ContextValue = {
  readonly language: Language;
  setLanguage: (value: Language) => void;
};
const Context = createContext<ContextValue | null>(null);
export const languageOptions = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic (العربية)" },
  { value: "he", label: "Hebrew (עברית)" },
] as const;
export function LanguageProvider(props: {
  children?: JSX.Element;
  defaultLanguage?: Language;
}) {
  const [language, setLanguage] = createSignal(props.defaultLanguage ?? "ar");
  return (
    <Context
      value={{
        get language() {
          return language();
        },
        setLanguage,
      }}
    >
      {props.children}
    </Context>
  );
}
export function useLanguageContext() {
  return useContext(Context) ?? undefined;
}
export function useTranslation<T extends Record<string, string>>(
  translations: Translations<T>,
  defaultLanguage: Language = "ar",
) {
  const context = useLanguageContext();
  const [localLanguage, setLocalLanguage] = createSignal(defaultLanguage);
  const language = () => context?.language ?? localLanguage();
  return {
    get language() {
      return language();
    },
    setLanguage: context?.setLanguage ?? setLocalLanguage,
    get dir() {
      return translations[language()].dir;
    },
    get locale() {
      return translations[language()].locale;
    },
    get t() {
      return translations[language()].values;
    },
  };
}

export function LanguageSelector(props: {
  value: Language;
  onValueChange: (value: Language) => void;
  class?: string;
  className?: string;
  languages?: Language[];
}) {
  return (
    <Select
      items={languageOptions}
      value={props.value}
      onValueChange={(value) => props.onValueChange(value as Language)}
    >
      <SelectTrigger
        size="sm"
        class={cn("w-36", props.class ?? props.className)}
        dir="ltr"
        data-name="language-selector"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        dir="ltr"
        class="data-open:animate-none data-closed:animate-none"
      >
        <SelectGroup>
          {languageOptions
            .filter((option) =>
              (props.languages ?? ["en", "ar", "he"]).includes(option.value),
            )
            .map((option) => (
              <SelectItem value={option.value}>{option.label}</SelectItem>
            ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
