/**
 * Source inventory only, using the exact Git revision, not a dirty working
 * tree. This mirrors the native loader's record boundaries and Construct
 * path projection, but does not substitute for the authoritative C# loader.
 */
import { execFileSync } from "node:child_process";
const checkout = process.argv[2];
const revision = process.argv[3] ?? "6a300933435c633b51f1d446fca09b9810dceb9e";
if (!checkout) throw Error("Usage: node tools/audit-native-entity-catalog.mjs CORE_CHECKOUT [REVISION]");
const git = (...args) => execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const sha = git("rev-parse", revision + "^{commit}").trim();
const report = { sourceRevision: sha, representation: "Authored native records; Construct component path identities projected; metadata excluded", rulesets: {} };
for (const ruleset of ["first-party-001", "dnd-5e", "dnd-5-5e", "fate-condensed"]) {
    const directory = "data/rulesets/" + ruleset + "/native/";
    const paths = git("ls-tree", "-r", "--name-only", sha, "--", directory)
        .split(/\r?\n/).filter(p => p.endsWith(".json"));
    if (!paths.length) throw Error("No native source files for " + ruleset);
    const counts = new Map(), identities = new Set();
    for (const file of paths) {
        const data = JSON.parse(git("show", sha + ":" + file));
        let records;
        const component = ruleset === "first-party-001" &&
            /^origination\/construct-assembly\/components\/([a-z0-9-]+)\/([a-z0-9-]+)\.json$/.exec(file.slice(directory.length));
        if (component) records = [{ ...data, id: "construct-component." + component[2], kind: "construct-component" }];
        else if (Array.isArray(data)) records = data;
        else if (Object.hasOwn(data, "id")) records = [data];
        else records = Object.entries(data).filter(([key]) => !key.startsWith("_"))
            .flatMap(([key, value]) => {
                if (!Array.isArray(value)) throw Error(file + ": invalid collection " + key);
                return value;
            });
        for (const record of records) {
            if (String(record?.kind).toLowerCase() === "metadata") continue;
            if (!record || typeof record.id !== "string" || typeof record.kind !== "string" || typeof record.name !== "string")
                throw Error(file + ": invalid authored entity");
            if (identities.has(record.id)) throw Error(ruleset + ": duplicate ID " + record.id);
            identities.add(record.id);
            const count = counts.get(record.kind) ?? { count: 0, exampleFile: file, exampleId: record.id };
            count.count++;
            counts.set(record.kind, count);
        }
    }
    report.rulesets[ruleset] = { sourceFiles: paths.length, totalEntities: identities.size,
        kinds: Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))) };
}
console.log(JSON.stringify(report, null, 2));
