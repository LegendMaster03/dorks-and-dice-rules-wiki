// Exercise computed geometry in a real browser; jsdom does not perform CSS layout.
// The fixture mirrors the Wiki's shell and pane classes without requiring Site tickets.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const candidates = process.env.CHROME_BIN ? [process.env.CHROME_BIN] :
    ["google-chrome", "chromium", "chromium-browser"];
const chrome = candidates.find(command => spawnSync(command, ["--version"], { encoding: "utf8" }).status === 0);
assert.ok(chrome, "A Chromium browser is required for computed layout regression tests.");

const stylesheetRoot = new URL("../src/RulesWiki.Web/wwwroot/", import.meta.url);
const styles = ["rules-core.css", "rules-core-detail.css", "rules-wiki-shell.css",
    "rules-reference-browser-phase1.css", "wiki-experience.css"]
    .map(name => readFileSync(new URL(name, stylesheetRoot), "utf8")).join("\n");
const fixture = `<!doctype html>
<html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; }
body { margin: 0; }
:root { --bs-body-bg: white; --bs-body-color: black; --bs-border-color: #ccc;
    --bs-tertiary-bg: #eee; --bs-secondary-bg: #ddd; }
.mt-3 { margin-top: 1rem; }
#site-header { height: 64px; }
${styles}
</style></head><body><div id="site-header"></div>
<div id="tool-root" class="rules-core-app wiki-experience" style="--wiki-host-offset:64px">
    <header class="rules-core-topbar rules-core-topbar-hosted" hidden aria-hidden="true">Local header</header>
    <nav class="wiki-ribbon"><select class="wiki-ruleset-selector"><option>Dorks &amp; Dice</option></select>
        <button>Wiki home</button><button>Characters</button><button>Search all rules</button></nav>
    <div class="rules-core-main mt-3" data-rules-view="library">
        <section class="rules-core-library-shell">
            <div class="rules-core-library-heading">Classes</div>
            <div class="rules-core-library-workspace has-selection">
                <section class="rules-core-library-index"><div class="rules-core-library-index-list">Warlock</div></section>
                <section class="rules-core-library-detail"><div class="rules-core-library-detail-loading">Loading reference…</div></section>
            </div>
        </section>
    </div>
</div><pre id="result"></pre><script>
const root = document.getElementById("tool-root");
const header = root.querySelector("header");
const nav = root.querySelector("nav");
const main = root.querySelector(".rules-core-main");
const workspace = root.querySelector(".rules-core-library-workspace");
const index = root.querySelector(".rules-core-library-index");
const detail = root.querySelector(".rules-core-library-detail");
const rect = el => el.getBoundingClientRect();
const check = (condition, message) => { if (!condition) throw Error(message); };
const near = (a, b, message) => check(Math.abs(a - b) <= 2, message + ": " + a + " vs " + b);
try {
    for (const hosted of [true, false]) {
        header.hidden = hosted;
        header.classList.toggle("rules-core-topbar-hosted", hosted);
        for (const dividerPresent of [false, true]) {
            workspace.querySelector(".wiki-pane-divider")?.remove();
            if (dividerPresent) {
                const divider = document.createElement("div");
                divider.className = "wiki-pane-divider";
                workspace.insertBefore(divider, detail);
            }
            for (const state of ["Loading reference…", "Warlock", "Select a rule", "Could not load reference"]) {
                detail.firstElementChild.textContent = state;
                near(rect(nav).top, hosted ? rect(root).top : rect(header).bottom, "Ribbon follows header");
                near(rect(main).top, rect(nav).bottom, "No gap between ribbon and reader");
                near(rect(main).bottom, rect(root).bottom, "Reader fills remaining viewport");
                near(rect(root).bottom, innerHeight, "Shell fits hosted viewport");
                near(rect(workspace).top, rect(main).top, "Workspace starts at reader top");
                near(rect(workspace).bottom, rect(main).bottom, "Workspace fills reader height");
                check(rect(detail).height > 100, "Detail retains usable height");
                if (innerWidth > 900) {
                    check(rect(index).width > 200, "Desktop index retains usable width");
                    check(rect(detail).width > 300, "Desktop detail retains usable width before and after divider");
                } else {
                    check(getComputedStyle(index).display === "none", "Compact selected view hides index");
                    check(rect(detail).width > 250, "Compact detail retains usable width");
                }
            }
        }
    }
    document.body.dataset.layoutResult = "pass";
} catch (error) {
    document.body.dataset.layoutResult = "fail";
    document.getElementById("result").textContent = error.message;
}
</script></body></html>`;

const temp = mkdtempSync(join(tmpdir(), "wiki-reader-layout-"));
try {
    const file = join(temp, "layout.html");
    writeFileSync(file, fixture);
    for (const size of ["1360,900", "500,900"]) {
        const result = spawnSync(chrome, ["--headless", "--no-sandbox", "--disable-dev-shm-usage",
            "--disable-gpu", "--no-first-run", "--no-default-browser-check",
            "--user-data-dir=" + join(temp, "profile-" + size), "--window-size=" + size,
            "--dump-dom", "file://" + file], { encoding: "utf8", timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
        assert.equal(result.status, 0, result.error?.message ?? result.stderr);
        assert.match(result.stdout, /<body data-layout-result="pass">/,
            "Reader layout failed at " + size + ": " +
            (result.stdout.match(/<pre id="result">([^<]*)<\/pre>/)?.[1] ?? "No result"));
    }
    console.log("Chromium reader layout passed: hosted and standalone, desktop and compact, all detail states, before and after divider insertion.");
} finally {
    rmSync(temp, { recursive: true, force: true });
}
