import { readFileSync } from "node:fs";

const dryRun = process.argv.includes("--dry-run");
const tokenPath = ".foundry-token";

const token = readFileSync(tokenPath, "utf8").trim();
if (!token || token === "fvttp_...") {
  console.error(`Set a valid Foundry token in ${tokenPath}.`);
  process.exit(1);
}

const moduleJson = JSON.parse(readFileSync("module.json", "utf8"));
const tag = `${moduleJson.version}`;
const notes = `${moduleJson.url}/releases/tag/${tag}`;

const response = await fetch("https://foundryvtt.com/_api/packages/release_version/", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: token,
  },
  body: JSON.stringify({
    id: moduleJson.id,
    "dry-run": dryRun,
    release: {
      version: moduleJson.version,
      manifest: moduleJson.manifest,
      notes,
      compatibility: moduleJson.compatibility,
    },
  }),
});

const responseData = await response.json();
if (!response.ok) {
  console.error("Foundry publish failed:", response.status, JSON.stringify(responseData));
  process.exit(1);
}

console.log("Foundry publish succeeded:", JSON.stringify(responseData));
