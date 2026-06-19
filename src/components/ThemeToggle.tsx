"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

// Applies the theme by setting data-theme on <html>. The initial value is set by an
// inline script in the layout <head> (no-flash); this component keeps React in sync and
// persists changes. Default is dark — the product's native aesthetic.
function getInitial(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  // Lazy initializer reads the data-theme the no-flash inline script already applied,
  // so no effect-driven setState is needed (and SSR returns the dark default).
  const [theme, setTheme] = useState<Theme>(getInitial);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("scorefit-theme", next);
    } catch {
      // private mode / storage disabled — the toggle still works for the session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-fg"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
