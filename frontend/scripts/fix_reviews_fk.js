require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const client = new Client(process.env.DATABASE_URL);

async function addForeignKeys() {
  try {
    await client.connect();

    console.log(
      "Adding missing foreign keys to reviews and chat_rooms tables...",
    );

    await client.query(`
      do $$
      begin
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_room_id_fkey') THEN
            ALTER TABLE reviews ADD CONSTRAINT reviews_room_id_fkey FOREIGN KEY (room_id) REFERENCES chat_rooms(room_id) ON DELETE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_customer_id_fkey') THEN
            ALTER TABLE reviews ADD CONSTRAINT reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_pro_id_fkey') THEN
            ALTER TABLE reviews ADD CONSTRAINT reviews_pro_id_fkey FOREIGN KEY (pro_id) REFERENCES users(user_id) ON DELETE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chat_rooms_request_id_fkey') THEN
            ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_request_id_fkey FOREIGN KEY (request_id) REFERENCES match_requests(request_id) ON DELETE CASCADE;
        END IF;
      end
      $$;
    `);

    console.log("Successfully added foreign keys.");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

addForeignKeys();
