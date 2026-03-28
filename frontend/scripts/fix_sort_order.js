const { Client } = require("pg");

const client = new Client({
  connectionString:
    "postgresql://postgres.sjhemxejhyztbsctkqvb:Wkaqls191214@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
});

async function main() {
  await client.connect();

  console.log("Connected to DB for Fixing sort_order");

  const { rows } = await client.query(
    `SELECT id, name, depth1, depth2 FROM public.categories`,
  );

  // Define parent order
  const orderMap = {
    "이사/청소": 100,
    "설치/수리": 200,
    "인테리어/시공": 300,
    "비즈니스/외주": 400,
    "이벤트/파티": 500,
    "레슨/튜터링": 600,
  };

  // Group all by depth1
  const byDepth1 = {};
  for (const r of rows) {
    if (!r.depth1) continue;
    if (!byDepth1[r.depth1]) byDepth1[r.depth1] = [];
    byDepth1[r.depth1].push(r);
  }

  for (const [d1Name, d1Rows] of Object.entries(byDepth1)) {
    const baseOrder = orderMap[d1Name] || 900;

    // Sort children alphabetically by name to give them deterministic sub-ordering
    d1Rows.sort((a, b) => a.name.localeCompare(b.name));

    for (let i = 0; i < d1Rows.length; i++) {
      const finalOrder = baseOrder + i;
      await client.query(
        `UPDATE public.categories SET sort_order = $1 WHERE id = $2`,
        [finalOrder, d1Rows[i].id],
      );
    }
  }

  console.log("Categories sort_order fixed successfully!");
  await client.end();
}

main().catch(console.error);
