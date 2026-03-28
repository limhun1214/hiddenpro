require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const client = new Client(process.env.DATABASE_URL);
(async () => {
  await client.connect();
  let res = await client.query(
    "SELECT constraint_name, table_name FROM information_schema.key_column_usage WHERE table_name = $1;",
    ["reviews"],
  );
  console.log("Constraints:", res.rows);
  const cols = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1;",
    ["reviews"],
  );
  console.log("Columns:", cols.rows);
  const fks = await client.query(`
    SELECT
        tc.table_schema, 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='reviews';
  `);
  console.log("Foreign Keys:", fks.rows);

  // also check chat_rooms
  const crooms = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1;",
    ["chat_rooms"],
  );
  console.log("ChatRooms cols:", crooms.rows);
  client.end();
})();
