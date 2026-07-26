(() => {
  const storageKey = "green-leaf-theme";
  let theme = "light";

  try {
    const saved = window.localStorage.getItem(storageKey);
    theme =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
  } catch {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.documentElement.dataset.theme = theme;
})();
