const fs = require("fs");
const path = require("path");

const dirs = ["./scripts", "./supabase/migrations"];
const cutoff = new Date("2026-03-04T00:00:00Z");

let deletedCount = 0;

dirs.forEach((d) => {
  if (!fs.existsSync(d)) return;
  const files = fs.readdirSync(d);
  files.forEach((f) => {
    const fp = path.join(d, f);
    const stats = fs.statSync(fp);
    if (!stats.isDirectory() && stats.mtime > cutoff) {
      fs.unlinkSync(fp);
      console.log("Deleted post-Mar 3 file:", fp, " (mtime:", stats.mtime, ")");
      deletedCount++;
    }
  });
});

const rootFiles = [
  "run_db_restore.js",
  "run_db_restore.ts",
  "test_admin.js",
  "test_admin2.js",
  "run_rollback.js",
];

rootFiles.forEach((f) => {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log("Deleted root file:", f);
    deletedCount++;
  }
});

console.log(`Cleanup complete. Deleted ${deletedCount} files.`);
