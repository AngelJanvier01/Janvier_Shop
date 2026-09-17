import { themeStorageKey } from "./theme-preference";

const themeBootstrap = [
  "(function(){",
  "try{",
  `var key="${themeStorageKey}";`,
  "var saved=window.localStorage.getItem(key);",
  'var preferred=window.matchMedia("(prefers-color-scheme: dark)").matches?"night":"neutral";',
  'var theme=saved==="night"||saved==="neutral"?saved:preferred;',
  "document.documentElement.dataset.theme=theme;",
  "}catch(error){}",
  "})();"
].join("");

export function ThemeBootstrap() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeBootstrap }}
      id="janvier-theme-bootstrap"
    />
  );
}
