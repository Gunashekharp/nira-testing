import { Button } from "./Button";

export function LanguageToggle({ value, onChange }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 p-1 shadow-soft">
      <Button variant={value === "en" ? "primary" : "ghost"} size="sm" onClick={() => onChange("en")}>
        English
      </Button>
      <Button variant={value === "hi" ? "primary" : "ghost"} size="sm" onClick={() => onChange("hi")}>
        हिन्दी
      </Button>
    </div>
  );
}
