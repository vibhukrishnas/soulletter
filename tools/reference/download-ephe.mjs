// Downloads the official Swiss Ephemeris planetary and lunar data files used by the
// reference test-suite. These files are distributed under the Swiss Ephemeris licence
// (AGPL-3.0 or Swiss Ephemeris Professional License) and are NOT committed.
//
// Usage: node tools/reference/download-ephe.mjs
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";

const BASE = "https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/";
// SHA-256 of the files verified on 2026-10-13 (aloistr/swisseph commit cae9ecd, 2026-05-29).
const FILES = {
  "sepl_18.se1": "ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66",
  "semo_18.se1": "1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7",
};
const DIR = path.resolve("tools/reference/ephe");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

await mkdir(DIR, { recursive: true });
for (const [name, expected] of Object.entries(FILES)) {
  const target = path.join(DIR, name);
  try {
    await access(target);
    const existing = sha256(await readFile(target));
    if (existing === expected) {
      console.log(`ok (cached) ${name}`);
      continue;
    }
  } catch {
    // not present yet
  }
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`Download failed for ${name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (got !== expected) {
    throw new Error(`Checksum mismatch for ${name}: expected ${expected}, got ${got}`);
  }
  await writeFile(target, buf);
  console.log(`downloaded ${name} (${buf.length} bytes)`);
}
