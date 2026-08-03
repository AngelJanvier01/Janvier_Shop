import { cp } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

// Next intentionally omits these folders from `output: standalone`. Copying
// them before the local production server starts makes `npm run start` match
// the Docker runtime image, where they are copied during the image build.
await Promise.all([
  cp(join(root, "public"), join(standalone, "public"), {
    force: true,
    recursive: true
  }),
  cp(join(root, ".next", "static"), join(standalone, ".next", "static"), {
    force: true,
    recursive: true
  })
]);

await import(pathToFileURL(join(standalone, "server.js")).href);
