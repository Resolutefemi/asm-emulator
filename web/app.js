/* ============================================================
   RenASM — release fetcher + renderer
   Pulls published releases from the GitHub API and renders
   download cards. Caches for 5 min in localStorage to stay
   under the unauthenticated rate limit (60 req/hour/IP).
   ============================================================ */

const REPO_OWNER = "Resolutefemi";
const REPO_NAME = "asm-emulator";
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=30`;
const RELEASES_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
const SOURCE_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

const CACHE_KEY = "renasm-releases-cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/* -------------------- Platform icons (inline SVG) -------------------- */
const ICONS = {
  macos: `<svg class="platform-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`,
  windows: `<svg class="platform-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>`,
  linux: `<svg class="platform-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/></svg>`,
  android: `<svg class="platform-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>`,
};

/* -------------------- Platform classification rules -------------------- */
const PLATFORMS = [
  {
    id: "macos",
    label: "macOS",
    icon: ICONS.macos,
    matchers: [
      { regex: /\.dmg$/i, label: ".dmg", priority: 1 },
      { regex: /\.app\.tar\.gz$/i, label: ".app.tar.gz", priority: 2 },
    ],
  },
  {
    id: "windows",
    label: "Windows",
    icon: ICONS.windows,
    matchers: [
      // Renamed Windows assets (dual-installer build, v0.2.5+):
      //   RenASM_*_x64-full.msi          → Full offline MSI (priority 1)
      //   RenASM_*_x64-lite-setup.exe    → Lite online NSIS (priority 2)
      //   RenASM_*_x64-full-setup.exe    → Full offline NSIS (priority 3, rarely used)
      //   RenASM_*_x64-lite.msi          → Lite online MSI (priority 4, rarely used)
      //
      // We RECOMMEND .msi over .exe within each tier (official Windows
      // Installer format, better Add/Remove Programs integration).
      // We RECOMMEND Full over Lite for guaranteed offline install.
      { regex: /-full\.msi$/i, label: ".msi (Full)", priority: 1 },
      { regex: /-lite-setup\.exe$/i, label: ".exe (Lite)", priority: 2 },
      { regex: /-full-setup\.exe$/i, label: ".exe (Full)", priority: 3 },
      { regex: /-lite\.msi$/i, label: ".msi (Lite)", priority: 4 },
      // Legacy single-installer naming (v0.2.4 and earlier):
      { regex: /\.msi$/i, label: ".msi", priority: 5 },
      { regex: /-setup\.exe$|\.exe$/i, label: ".exe", priority: 6 },
    ],
  },
  {
    id: "linux",
    label: "Linux",
    icon: ICONS.linux,
    matchers: [
      { regex: /\.appimage$/i, label: ".AppImage", priority: 1 },
      { regex: /\.deb$/i, label: ".deb", priority: 2 },
      { regex: /\.rpm$/i, label: ".rpm", priority: 3 },
    ],
  },
  {
    id: "android",
    label: "Android",
    icon: ICONS.android,
    matchers: [{ regex: /\.apk$/i, label: ".apk", priority: 1 }],
  },
];

/* -------------------- Helpers -------------------- */
function classifyAsset(asset) {
  for (const platform of PLATFORMS) {
    for (const m of platform.matchers) {
      if (m.regex.test(asset.name)) {
        return {
          platform: platform.id,
          platformLabel: platform.label,
          icon: platform.icon,
          fileLabel: m.label,
          priority: m.priority,
          name: asset.name,
          url: asset.browser_download_url,
          size: asset.size,
          downloadCount: asset.download_count,
        };
      }
    }
  }
  return null;
}

function groupAssetsByPlatform(assets) {
  const groups = {};
  for (const p of PLATFORMS) groups[p.id] = [];
  const unclassified = [];

  for (const asset of assets) {
    const c = classifyAsset(asset);
    if (c) groups[c.platform].push(c);
    else unclassified.push(asset);
  }

  // Sort each group by priority (1 = best)
  for (const id of Object.keys(groups)) {
    groups[id].sort((a, b) => a.priority - b.priority);
  }

  return { groups, unclassified };
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.split("T")[0];
  }
}

function versionFromTag(tag) {
  // Strip leading "app-v" or "v" prefix
  return tag.replace(/^app-v/i, "").replace(/^v/i, "");
}

function detectPlatform() {
  const ua = navigator.userAgent || navigator.platform || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return null; // iOS not supported
  if (/mac/i.test(ua)) return "macos";
  if (/win/i.test(ua)) return "windows";
  if (/linux/i.test(ua)) return "linux";
  return null;
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* -------------------- API + cache -------------------- */
async function fetchReleases() {
  // Try cache first
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        return { releases: data, fromCache: true };
      }
    }
  } catch {
    // ignore cache read errors
  }

  const response = await fetch(API_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!response.ok) {
    if (response.status === 403) {
      // rate limit
      const remaining = response.headers.get("X-RateLimit-Remaining");
      if (remaining === "0") {
        throw new Error("rate-limit");
      }
    }
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  // Public API only returns published releases, but filter drafts defensively
  const published = Array.isArray(data)
    ? data.filter((r) => !r.draft)
    : [];

  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data: published })
    );
  } catch {
    // localStorage might be full or disabled; ignore
  }

  return { releases: published, fromCache: false };
}

/* -------------------- Renderers -------------------- */
function renderPlatformCard(classified, recommended) {
  if (!classified || classified.length === 0) {
    // No asset for this platform in this release
    const platform = PLATFORMS.find((p) => p.id === arguments[2]);
    return `
      <div class="platform-card is-unavailable" aria-disabled="true">
        ${platform.icon}
        <div>
          <div class="platform-name">${platform.label}</div>
          <div class="platform-meta">Not available in this release</div>
        </div>
      </div>`;
  }

  const top = classified[0]; // highest priority match
  const isRecommended = recommended === top.platform;
  const recommendedClass = isRecommended ? " is-recommended" : "";
  const sizeStr = formatBytes(top.size);

  return `
    <a class="platform-card${recommendedClass}" href="${top.url}" 
       aria-label="Download RenASM for ${top.platformLabel} (${top.fileLabel}${sizeStr ? ", " + sizeStr : ""})">
      ${top.icon}
      <div>
        <div class="platform-name">${top.platformLabel}</div>
        <div class="platform-file">${top.fileLabel}</div>
        ${sizeStr ? `<div class="platform-meta">${sizeStr}</div>` : ""}
      </div>
    </a>`;
}

function renderHero(release) {
  const eyebrow = document.getElementById("hero-eyebrow");
  const grid = document.getElementById("latest-downloads");
  const meta = document.getElementById("hero-meta");

  if (!release) {
    eyebrow.textContent = "No releases yet";
    eyebrow.className = "hero-eyebrow is-error";
    grid.innerHTML = `
      <p class="state-message">
        No published releases yet.
        <br>
        <a href="${RELEASES_PAGE}" target="_blank" rel="noopener noreferrer">Check GitHub for upcoming releases ↗</a>
      </p>`;
    meta.innerHTML = "";
    return;
  }

  const version = versionFromTag(release.tag_name);
  const date = formatDate(release.published_at);
  eyebrow.textContent = `Latest · v${version}`;
  eyebrow.className = "hero-eyebrow is-latest";

  const { groups } = groupAssetsByPlatform(release.assets || []);
  const recommended = detectPlatform();

  // Render one card per platform, in PLATFORMS order
  const cards = PLATFORMS.map(
    (p) => renderPlatformCard(groups[p.id], recommended, p.id)
  ).join("");

  grid.innerHTML = cards;

  const releaseUrl = release.html_url;
  meta.innerHTML = `
    Version ${version} · Released ${date} ·
    <a href="${releaseUrl}" target="_blank" rel="noopener noreferrer">View release notes ↗</a>`;
}

function renderVersionsList(releases) {
  const list = document.getElementById("versions-list");

  if (!releases || releases.length === 0) {
    list.innerHTML = `
      <p class="state-message">
        No release history yet.
        <a href="${RELEASES_PAGE}" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>
      </p>`;
    return;
  }

  const cards = releases
    .map((r, idx) => {
      const version = versionFromTag(r.tag_name);
      const date = formatDate(r.published_at);
      const isLatest = idx === 0;
      const isPrerelease = !!r.prerelease;

      const { groups, unclassified } = groupAssetsByPlatform(r.assets || []);

      // Build asset buttons (one per asset, grouped by platform then unclassified)
      // The first (priority 1) asset of each platform gets a "Recommended" pill
      // so users know which file to pick when there are multiple options.
      const allButtons = [];
      for (const p of PLATFORMS) {
        const platformAssets = groups[p.id];
        for (let i = 0; i < platformAssets.length; i++) {
          const a = platformAssets[i];
          const sizeStr = formatBytes(a.size);
          const isRecommended = i === 0 && platformAssets.length > 1;
          allButtons.push(`
            <a class="asset-button${isRecommended ? " is-recommended" : ""}" href="${a.url}" 
               aria-label="Download ${escapeHtml(a.name)}${isRecommended ? " (recommended)" : ""}">
              <span class="asset-platform">${a.platformLabel}</span>
              <span>${a.fileLabel}</span>
              ${sizeStr ? `<span class="asset-size">${sizeStr}</span>` : ""}
              ${isRecommended ? `<span class="asset-rec">Recommended</span>` : ""}
            </a>`);
        }
      }
      for (const u of unclassified) {
        const sizeStr = formatBytes(u.size);
        allButtons.push(`
          <a class="asset-button" href="${u.browser_download_url}" 
             aria-label="Download ${escapeHtml(u.name)}">
            <span class="asset-platform">File</span>
            <span>${escapeHtml(u.name)}</span>
            ${sizeStr ? `<span class="asset-size">${sizeStr}</span>` : ""}
          </a>`);
      }

      const assetsHtml =
        allButtons.length > 0
          ? `<div class="version-assets">${allButtons.join("")}</div>`
          : `<p class="state-message">No downloadable assets — <a href="${r.html_url}" target="_blank" rel="noopener noreferrer">view release ↗</a></p>`;

      const notesHtml = r.body
        ? `<div class="version-notes">${escapeHtml(r.body)}</div>`
        : "";

      const badgeHtml = isLatest
        ? `<span class="version-badge">Latest</span>`
        : isPrerelease
        ? `<span class="version-badge is-prerelease">Pre-release</span>`
        : "";

      return `
        <article class="version-card${isLatest ? " is-latest" : ""}">
          <header class="version-card-header">
            <div class="version-card-title">
              <span class="version-number">v${escapeHtml(version)}</span>
              ${badgeHtml}
            </div>
            <span class="version-date">${date}</span>
          </header>
          ${assetsHtml}
          ${notesHtml}
          <div class="version-footer">
            <a href="${r.html_url}" target="_blank" rel="noopener noreferrer">View full release notes on GitHub ↗</a>
          </div>
        </article>`;
    })
    .join("");

  list.innerHTML = cards;
}

function renderError(message) {
  const eyebrow = document.getElementById("hero-eyebrow");
  const grid = document.getElementById("latest-downloads");
  const meta = document.getElementById("hero-meta");
  const list = document.getElementById("versions-list");

  const isRateLimit = message === "rate-limit";
  const headline = isRateLimit
    ? "GitHub API rate limit reached"
    : "Couldn't load releases";
  const detail = isRateLimit
    ? "Please try again in a few minutes."
    : "Please check your connection and try again.";

  eyebrow.textContent = headline;
  eyebrow.className = "hero-eyebrow is-error";

  grid.innerHTML = `
    <p class="state-message is-error">
      ${detail}
      <br>
      <a href="${RELEASES_PAGE}" target="_blank" rel="noopener noreferrer">Browse releases on GitHub ↗</a>
    </p>`;
  meta.innerHTML = "";
  list.innerHTML = `
    <p class="state-message is-error">
      ${detail}
      <a href="${RELEASES_PAGE}" target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>
    </p>`;
}

/* -------------------- Init -------------------- */
async function init() {
  document.getElementById("year").textContent = new Date().getFullYear();

  try {
    const { releases } = await fetchReleases();
    const latest = releases && releases.length > 0 ? releases[0] : null;
    renderHero(latest);
    renderVersionsList(releases);
  } catch (err) {
    console.error("[RenASM] Failed to load releases:", err);
    renderError(err.message || "unknown");
  }
}

/* -------------------- Sticky navbar scroll effect --------------------
   Adds .is-scrolled to .nav-wrapper once the user scrolls past ~20px.
   This makes the navbar more opaque + compact + accent-bordered when
   content is scrolling behind it, improving readability.
   Uses passive listener + requestAnimationFrame for perf. */
function initStickyNav() {
  const wrapper = document.getElementById("nav-wrapper");
  if (!wrapper) return;

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (window.scrollY > 20) {
        wrapper.classList.add("is-scrolled");
      } else {
        wrapper.classList.remove("is-scrolled");
      }
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll(); // initialize state on load
}

init();
initStickyNav();
