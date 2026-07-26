import { useLayoutEffect, useState } from "react";

export type ColorTheme = "light" | "dark";

const storageKey = "green-leaf-theme";

function documentTheme(): ColorTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<ColorTheme>("light");

  useLayoutEffect(() => {
    setTheme(documentTheme());
  }, []);

  function toggleTheme() {
    const nextTheme: ColorTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    try {
      window.localStorage.setItem(storageKey, nextTheme);
    } catch {
      // Theme switching still works when browser storage is unavailable.
    }
  }

  return { theme, toggleTheme };
}
