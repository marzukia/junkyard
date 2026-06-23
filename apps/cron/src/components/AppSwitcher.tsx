import { useEffect, useRef, useState } from "react";
import "./AppSwitcher.css";

interface CatalogueEntry {
  slug: string;
  name: string;
  category: string;
  order: number;
  tagline: string;
  path: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  image: "Image & Media",
  text: "Text & Code",
  ai: "In-browser AI",
  docs: "Docs & Utility",
};

const CATEGORY_ORDER = ["image", "text", "ai", "docs"];

function ArrowLeftIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function AppSwitcher() {
  const [tools, setTools] = useState<CatalogueEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  // Fetch catalogue on mount
  useEffect(() => {
    fetch("/catalogue.json")
      .then((r) => r.json())
      .then((data: CatalogueEntry[]) => {
        setTools(data.sort((a, b) => a.order - b.order));
      })
      .catch(() => {
        // Degrade gracefully: dashboard link still renders, menu list omitted
      });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape; focus back to button
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Move focus into filter when menu opens
  useEffect(() => {
    if (open) {
      filterRef.current?.focus();
    }
  }, [open]);

  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "";

  const filterLower = filter.toLowerCase();
  const filtered = filterLower
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().includes(filterLower) ||
          t.slug.toLowerCase().includes(filterLower) ||
          t.tagline.toLowerCase().includes(filterLower),
      )
    : tools;

  // Group by category in canonical order
  const groups = CATEGORY_ORDER.map((cat) => ({
    key: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    items: filtered.filter((t) => t.category === cat),
  })).filter((g) => g.items.length > 0);

  function toggle() {
    if (open) {
      setOpen(false);
      buttonRef.current?.focus();
    } else {
      setFilter("");
      setOpen(true);
    }
  }

  return (
    <div className="jy-switcher">
      <a href="/" className="jy-switcher__back" aria-label="Back to dashboard">
        <ArrowLeftIcon />
        <span>Dashboard</span>
      </a>

      <div className="jy-switcher__menu-wrapper">
        <button
          ref={buttonRef}
          type="button"
          className="jy-switcher__trigger"
          onClick={toggle}
          aria-haspopup="true"
          aria-expanded={open}
        >
          <span>All tools</span>
          <ChevronDownIcon />
        </button>

        {open && (
          <div ref={menuRef} className="jy-switcher__menu" role="dialog" aria-label="All tools">
            <div className="jy-switcher__filter-wrap">
              <input
                ref={filterRef}
                type="search"
                className="jy-switcher__filter"
                placeholder="Filter tools..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Filter tools"
              />
            </div>

            {groups.length === 0 && (
              <div className="jy-switcher__empty">No tools match</div>
            )}

            {groups.map((group) => (
              <div key={group.key} className="jy-switcher__group">
                <div className="jy-switcher__group-label">{group.label}</div>
                {group.items.map((tool) => {
                  const isActive =
                    currentPath === tool.path ||
                    currentPath.startsWith(tool.path);
                  return (
                    <a
                      key={tool.slug}
                      href={tool.path}
                      className={
                        "jy-switcher__item" +
                        (isActive ? " jy-switcher__item--active" : "")
                      }
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <span className="jy-switcher__item-name">{tool.name}</span>
                      <span className="jy-switcher__item-tag">{tool.tagline}</span>
                    </a>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
