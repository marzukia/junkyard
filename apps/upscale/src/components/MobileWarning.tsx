import { useEffect, useState } from "react";
import "./MobileWarning.css";

// Tag vocabulary mirrored from scripts/catalogue-schema.ts AppTag.
// Keep in sync if new tags are added to the catalogue schema.
type AppTag = "webgpu" | "on-device-ai" | "large-download" | "beta";

// Pure decision function - extracted for unit testing.
// Returns the warning message string or null if no warning should be shown.
export function mobileWarningMessage(
  tags: AppTag[],
  isPhone: boolean,
  dismissed: boolean
): string | null {
  if (!isPhone) return null;
  if (dismissed) return null;

  if (tags.includes("webgpu")) {
    return "This tool needs a GPU (WebGPU) and may be slow or crash on phones. Best on a desktop browser.";
  }
  if (tags.includes("on-device-ai")) {
    return "This tool downloads and runs an AI model in your browser and may be slow or crash on phones. Best on a desktop browser.";
  }
  if (tags.includes("large-download")) {
    return "This tool processes in your browser and downloads a large engine; big jobs can crash mobile. Best on a desktop browser.";
  }

  return null;
}

// Detect whether the current device is a phone.
// SSR-safe: guards typeof window and typeof navigator.
function detectPhone(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const phoneUA = /Android.*Mobile|iPhone|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile/i;
  if (phoneUA.test(navigator.userAgent)) return true;

  // Coarse pointer (touch) AND narrow viewport
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches &&
    window.innerWidth < 820
  ) {
    return true;
  }

  return false;
}

// Derive the current app's slug from window.location.pathname.
// Assumes path shape /<slug>/ or /<slug>.
function slugFromPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] ?? "";
}

interface CatalogueEntry {
  slug: string;
  path: string;
  tags?: AppTag[];
}

export function MobileWarning() {
  const [message, setMessage] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isPhone = detectPhone();
    if (!isPhone) return; // skip fetch entirely on non-phones

    const currentSlug = slugFromPath(window.location.pathname);
    setSlug(currentSlug);

    const storageKey = `jy-mobwarn-dismissed-${currentSlug}`;
    const dismissed = sessionStorage.getItem(storageKey) === "1";

    const controller = new AbortController();
    fetch("/catalogue.json", { signal: controller.signal })
      .then((r) => r.json())
      .then((entries: CatalogueEntry[]) => {
        // Match by path /<slug>/
        const entry = entries.find((e) => e.path === `/${currentSlug}/` || e.slug === currentSlug);
        const tags: AppTag[] = entry?.tags ?? [];
        const msg = mobileWarningMessage(tags, isPhone, dismissed);
        setMessage(msg);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Catalogue unavailable: degrade silently, no warning shown.
      });

    return () => controller.abort();
  }, []);

  if (!message) return null;

  function dismiss() {
    if (typeof window === "undefined") return;
    const storageKey = `jy-mobwarn-dismissed-${slug}`;
    sessionStorage.setItem(storageKey, "1");
    setMessage(null);
  }

  return (
    <div className="jy-mobwarn" role="status" aria-live="polite">
      <span className="jy-mobwarn__icon" aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
      <span className="jy-mobwarn__text">{message}</span>
      <button
        type="button"
        className="jy-mobwarn__dismiss"
        onClick={dismiss}
        aria-label="Dismiss warning"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
