/** Loopback-only preview of the actual Wiki app against captured fixtures.
 * No Site credentials, live Core traffic, writes, or deployment. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createOriginsFixtureBoundary } from "./origins-navigation-fixture-boundary.mjs";
const { handle } = createOriginsFixtureBoundary();
const base = "/tools/rules-wiki";
const assets = fileURLToPath(new URL("../src/RulesWiki.Web/wwwroot/", import.meta.url));
const port = Number(process.env.PORT ?? 8765);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error("Invalid PORT");
const mime = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
function shell(route) {
    const contextUrl = "/context?route=" + encodeURIComponent(route);
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Character Origins — local fixture preview</title><style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,sans-serif;color:#242424;background:#fff}' +
        ':root{--bs-body-bg:#fff;--bs-body-color:#242424;--bs-border-color:#d6dcdf;--bs-primary:#1769cf;--bs-tertiary-bg:#f1f3f5;--bs-secondary-color:#536168}' +
        '#fixture-banner{padding:.5rem .75rem;border-bottom:1px solid #d6dcdf;background:#f1f3f5;font-size:.85rem}button,input,select{font:inherit}a{color:#1769cf}</style></head><body>' +
        '<header id="fixture-banner">Local fixture preview — reference data only; no live Core access. Some native details are not captured.</header>' +
        '<main id="tool-root" data-tool-context-url="' + contextUrl + '"></main>' +
        '<script>window.dorksAndDiceToolHost={setContentLayout(){}};</script><script type="module" src="/assets/app.js"></script></body></html>';
}
const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url, "http://127.0.0.1");
        if (req.method === "GET" && url.pathname === "/") {
            res.writeHead(302, { Location: base + "/rulesets/first-party-001/origins/overview" }); res.end(); return;
        }
        if (req.method === "GET" && (url.pathname === base || url.pathname.startsWith(base + "/"))) {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
            res.end(shell(url.pathname.slice(base.length) || "/")); return;
        }
        if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
            const file = resolve(assets, decodeURIComponent(url.pathname.slice("/assets/".length)));
            if (!file.startsWith(resolve(assets) + sep) || !mime[extname(file)]) { res.writeHead(404); res.end(); return; }
            const bytes = await readFile(file);
            res.writeHead(200, { "Content-Type": mime[extname(file)], "Cache-Control": "no-store" }); res.end(bytes); return;
        }
        if (url.pathname === "/context" || url.pathname.startsWith("/host/api/")) {
            const chunks = [];
            let size = 0;
            for await (const chunk of req) {
                size += chunk.length;
                if (size > 64 * 1024) { res.writeHead(413); res.end(); return; }
                chunks.push(chunk);
            }
            const response = await handle(url.pathname, { body: Buffer.concat(chunks).toString("utf8") }, url.searchParams.get("route") ?? "/");
            res.writeHead(response.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
            res.end(await response.text()); return;
        }
        res.writeHead(404); res.end();
    } catch {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Fixture unavailable" }));
    }
});
server.listen(port, "127.0.0.1", () => console.log("Origins fixture preview: http://127.0.0.1:" + server.address().port));
