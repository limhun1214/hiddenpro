const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const FRONTEND_DIR = path.join(__dirname, "frontend");

function findLatestBackup() {
  const dirs = fs.readdirSync(FRONTEND_DIR);
  const backups = dirs.filter(
    (d) =>
      d.startsWith("backup_") &&
      fs.statSync(path.join(FRONTEND_DIR, d)).isDirectory(),
  );
  if (backups.length === 0) return null;
  backups.sort();
  return backups[backups.length - 1]; // latest
}

try {
  const latestBackup = findLatestBackup();
  if (!latestBackup) {
    throw new Error("No backup folder found.");
  }
  const backupPath = path.join(FRONTEND_DIR, latestBackup);
  console.log(`Found latest backup: ${latestBackup}`);

  const srcDir = path.join(FRONTEND_DIR, "src");
  if (fs.existsSync(srcDir)) {
    console.log(`Deleting current src directory...`);
    fs.rmSync(srcDir, { recursive: true, force: true });
  }

  const zipFile = path.join(backupPath, "source_code_backup.zip");
  if (fs.existsSync(zipFile)) {
    console.log(`Extracting ${zipFile}...`);
    execSync(
      `powershell.exe -NoProfile -NonInteractive -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${FRONTEND_DIR}' -Force"`,
      { stdio: "inherit" },
    );
  } else {
    console.warn(`No source_code_backup.zip found in ${latestBackup}`);
  }

  const envBackup = path.join(backupPath, "env_backup.txt");
  if (fs.existsSync(envBackup)) {
    console.log(`Restoring .env.local from ${envBackup}...`);
    fs.copyFileSync(envBackup, path.join(FRONTEND_DIR, ".env.local"));
  } else {
    console.warn(`No env_backup.txt found in ${latestBackup}`);
  }

  const nextCache = path.join(FRONTEND_DIR, ".next");
  if (fs.existsSync(nextCache)) {
    console.log(`Deleting .next cache directory...`);
    fs.rmSync(nextCache, { recursive: true, force: true });
  }

  console.log("Rollback completed successfully.");
} catch (error) {
  console.error(`Rollback failed: ${error.message}`);
  process.exit(1);
}
