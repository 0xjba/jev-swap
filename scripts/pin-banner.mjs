// Points the README banner at the version being published (jsDelivr serves it from the npm package),
// so the npm and GitHub READMEs show that release's banner. Runs from prepublishOnly.
import fs from "node:fs";

const { version } = JSON.parse(fs.readFileSync("package.json", "utf8"));
const readme = fs.readFileSync("README.md", "utf8");
const pinned = readme.replace(/cdn\.jsdelivr\.net\/npm\/jev-swap@[^/]+\/assets\/banner\.png/, `cdn.jsdelivr.net/npm/jev-swap@${version}/assets/banner.png`);
if (pinned !== readme) {
  fs.writeFileSync("README.md", pinned);
  console.log(`README banner pinned to jev-swap@${version}: commit README.md after publishing`);
}
