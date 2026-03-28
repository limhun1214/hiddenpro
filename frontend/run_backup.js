const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function doBackup() {
  const backupDir = path.join(__dirname, "backup_20260226");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 1. Env backup
  const envPath = path.join(__dirname, ".env.local");
  const defaultEnvPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, path.join(backupDir, "env_backup.txt"));
  } else if (fs.existsSync(defaultEnvPath)) {
    fs.copyFileSync(defaultEnvPath, path.join(backupDir, "env_backup.txt"));
  }

  // 2. Schema backup
  const typesPath = path.join(__dirname, "src", "lib", "supabase.ts");
  let schemaContent = "";
  if (fs.existsSync(typesPath)) {
    schemaContent += fs.readFileSync(typesPath, "utf8") + "\n\n";
  }
  const sqlMigratePath = path.join(__dirname, "migrate_reviews.sql");
  if (fs.existsSync(sqlMigratePath)) {
    schemaContent += fs.readFileSync(sqlMigratePath, "utf8");
  }
  fs.writeFileSync(
    path.join(backupDir, "db_full_backup.json"),
    JSON.stringify({ schema: schemaContent }, null, 2),
  );

  // 3. Zip source
  try {
    const zipPath = path.join(backupDir, "source_code_backup.zip");
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    execSync(
      `tar -a -c -f "${zipPath}" --exclude=node_modules --exclude=.next --exclude=.git --exclude=backup_* *`,
      {
        cwd: __dirname,
        stdio: "inherit",
      },
    );
    console.log("Zip created successfully");
  } catch (e) {
    console.error("Error creating zip:", e.message);
  }
}

doBackup();
