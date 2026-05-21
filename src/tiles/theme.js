/**
 * Shared CSS injected into every SVG tile.
 *
 * CSS custom properties default to dark mode; the @media block overrides
 * them for light mode. Because SVG <img> elements render in a sandboxed
 * context that still respects the user's prefers-color-scheme, both GitHub's
 * light/dark toggle and the OS preference are honored automatically.
 *
 * Usage: embed ${THEME_CSS} as the first child of the <svg> element,
 * before any <defs>. Gradient <stop> colours must use the style attribute
 * (style="stop-color:var(--bg)") rather than the stop-color attribute so
 * CSS variables resolve correctly.
 */
export const THEME_CSS = `<style>
  :root{
    --bg:#0d1117;--bg2:#161b22;
    --fg:#ffffff;
    --fg85:rgba(255,255,255,.85);--fg75:rgba(255,255,255,.75);
    --fg60:rgba(255,255,255,.60);--fg40:rgba(255,255,255,.40);
    --fg35:rgba(255,255,255,.35);--fg30:rgba(255,255,255,.30);
    --fg25:rgba(255,255,255,.25);--fg15:rgba(255,255,255,.15);
    --fg10:rgba(255,255,255,.10);--fg08:rgba(255,255,255,.08);
    --fg07:rgba(255,255,255,.07);--fg06:rgba(255,255,255,.06)
  }
  @media(prefers-color-scheme:light){
    :root{
      --bg:#ffffff;--bg2:#f6f8fa;
      --fg:#24292f;
      --fg85:rgba(0,0,0,.75);--fg75:rgba(0,0,0,.65);
      --fg60:rgba(0,0,0,.55);--fg40:rgba(0,0,0,.40);
      --fg35:rgba(0,0,0,.35);--fg30:rgba(0,0,0,.30);
      --fg25:rgba(0,0,0,.25);--fg15:rgba(0,0,0,.12);
      --fg10:rgba(0,0,0,.10);--fg08:rgba(0,0,0,.09);
      --fg07:rgba(0,0,0,.07);--fg06:rgba(0,0,0,.05)
    }
  }
</style>`;
