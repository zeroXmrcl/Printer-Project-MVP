"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(current);
  }, []);

  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={next === "light" ? "Switch to paper theme" : "Switch to ink theme"}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        document.documentElement.style.colorScheme = next;
        localStorage.setItem("printcast-theme", next);
        setTheme(next);
      }}
    >
      {next === "light" ? "Paper" : "Ink"}
    </button>
  );
}
