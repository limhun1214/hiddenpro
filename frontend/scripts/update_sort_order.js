const { Client } = require("pg");

const client = new Client({
  connectionString:
    "postgresql://postgres.sjhemxejhyztbsctkqvb:Wkaqls191214@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
});

async function main() {
  await client.connect();

  console.log("Connected to DB");

  // 1. Add sort_order column
  await client.query(
    `ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 999;`,
  );
  console.log("Column sort_order added or exists");

  const { rows } = await client.query(`SELECT * FROM public.categories`);

  // Define parent order
  const orderMap = {
    "이사/청소": 100,
    "설치/수리": 200,
    "인테리어/시공": 300,
    "비즈니스/외주": 400,
    "이벤트/파티": 500,
    "레슨/튜터링": 600,
  };

  const parents = rows.filter((r) => !r.parent_id);
  const parentIdMap = {};
  for (const p of parents) {
    parentIdMap[p.id] = p.name;
    const baseOrder = orderMap[p.name] || 900;
    await client.query(
      `UPDATE public.categories SET sort_order = $1 WHERE id = $2`,
      [baseOrder, p.id],
    );
  }

  const children = rows.filter((r) => r.parent_id);
  // group by parent_id
  const childrenByParent = {};
  for (const c of children) {
    if (!childrenByParent[c.parent_id]) childrenByParent[c.parent_id] = [];
    childrenByParent[c.parent_id].push(c);
  }

  for (const [pId, childs] of Object.entries(childrenByParent)) {
    const pName = parentIdMap[pId];
    const baseOrder = orderMap[pName] || 900;

    // sort alphabetically to assign sub-order
    childs.sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < childs.length; i++) {
      await client.query(
        `UPDATE public.categories SET sort_order = $1 WHERE id = $2`,
        [baseOrder + i + 1, childs[i].id],
      );
    }
  }

  console.log("Categories sort_order updated successfully!");
  await client.end();
}

main().catch(console.error);
