"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const isDark = root.classList.toggle("dark");
    try {
      localStorage.setItem("resumeaw-theme", isDark ? "dark" : "light");
    } catch {
      // storage unavailable — theme still applies for this session
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Toggle light/dark theme"
      aria-label="Toggle light/dark theme"
      className={`btn-secondary h-9 w-9 !px-0 ${className}`}
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </button>
  );
}
