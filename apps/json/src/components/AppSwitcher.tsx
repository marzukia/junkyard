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

// Humanize an unknown category id: capitalize each word, replace dashes with spaces.
function humanizeCategory(cat: string): string {
  return cat
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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

  // Fetch catalogue on mount; abort on unmount to prevent setState after unmount.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/catalogue.json", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: CatalogueEntry[]) => {
        setTools(data.sort((a, b) => a.order - b.order));
      })
      .catch((err) => {
        // Abort errors are expected on unmount; ignore them.
        if (err instanceof Error && err.name === "AbortError") return;
        // Other errors: degrade gracefully - dashboard link still renders.
      });
    return () => controller.abort();
  }, []);

  // Close on outside click/touch (pointerdown covers mouse + touch).
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open]);

  // Close on Escape; restore focus to trigger button.
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

  // Move focus into filter when menu opens.
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

  // Derive category order from the sorted catalogue (first-seen order by `order` field).
  // This ensures unknown future categories are never silently dropped.
  const categoryOrder: string[] = [];
  for (const t of filtered) {
    if (!categoryOrder.includes(t.category)) {
      categoryOrder.push(t.category);
    }
  }

  const groups = categoryOrder.map((cat) => ({
    key: cat,
    label: CATEGORY_LABELS[cat] ?? humanizeCategory(cat),
    items: filtered.filter((t) => t.category === cat),
  }));

  // Flat list of all item elements for roving tabindex / arrow-key nav.
  const allItems = groups.flatMap((g) => g.items);

  function focusItemByIndex(idx: number) {
    if (idx < 0 || idx >= allItems.length) return;
    const slug = allItems[idx].slug;
    const el = menuRef.current?.querySelector<HTMLAnchorElement>(
      `[data-slug="${slug}"]`,
    );
    el?.focus();
  }

  function handleFilterKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItemByIndex(0);
    }
  }

  function handleItemKeyDown(
    e: React.KeyboardEvent<HTMLAnchorElement>,
    idx: number,
  ) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx + 1 < allItems.length) {
        focusItemByIndex(idx + 1);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx === 0) {
        filterRef.current?.focus();
      } else {
        focusItemByIndex(idx - 1);
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItemByIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItemByIndex(allItems.length - 1);
    }
    // Tab: let it fall through; the focus-trap below handles it.
  }

  // Focus trap: prevent Tab from escaping the open menu.
  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const focusable = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        'input, a[href], button, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

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
      {/* Drop aria-label so visible "Dashboard" text is the accessible name (WCAG 2.5.3). */}
      <a href="/" className="jy-switcher__back">
        <ArrowLeftIcon />
        <span>Dashboard</span>
      </a>

      <div className="jy-switcher__menu-wrapper">
        <button
          ref={buttonRef}
          type="button"
          className="jy-switcher__trigger"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span>All tools</span>
          <ChevronDownIcon />
        </button>

        {open && (
          <div
            ref={menuRef}
            className="jy-switcher__menu"
            role="dialog"
            aria-label="All tools"
            aria-modal="true"
            onKeyDown={handleMenuKeyDown}
          >
            <div className="jy-switcher__filter-wrap">
              <input
                ref={filterRef}
                type="search"
                className="jy-switcher__filter"
                placeholder="Filter tools..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Filter tools"
                onKeyDown={handleFilterKeyDown}
              />
            </div>

            {groups.length === 0 && (
              <div className="jy-switcher__empty">No tools match</div>
            )}

            {groups.map((group) => (
              <div key={group.key} className="jy-switcher__group">
                <div className="jy-switcher__group-label">{group.label}</div>
                {group.items.map((tool) => {
                  const globalIdx = allItems.indexOf(tool);
                  const isActive =
                    currentPath === tool.path ||
                    currentPath.startsWith(tool.path);
                  return (
                    <a
                      key={tool.slug}
                      href={tool.path}
                      data-slug={tool.slug}
                      className={
                        "jy-switcher__item" +
                        (isActive ? " jy-switcher__item--active" : "")
                      }
                      aria-current={isActive ? "page" : undefined}
                      tabIndex={0}
                      onClick={() => setOpen(false)}
                      onKeyDown={(e) => handleItemKeyDown(e, globalIdx)}
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
