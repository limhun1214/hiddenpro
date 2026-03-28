const { Client } = require("pg");
const url =
  "postgresql://postgres.sjhemxejhyztbsctkqvb:Wkaqls191214@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres";
const client = new Client({ connectionString: url });

async function run() {
  await client.connect();
  try {
    // 버킷 생성 (이미 있으면 패스)
    await client.query(`
      INSERT INTO storage.buckets (id, name, public) 
      VALUES ('quote_images', 'quote_images', true) 
      ON CONFLICT (id) DO NOTHING;
    `);

    // 모든 사람이 다운로드 가능하게 정책 추가
    await client.query(`
      CREATE POLICY "Public Access" 
      ON storage.objects FOR SELECT 
      USING ( bucket_id = 'quote_images' );
    `);

    // 모든 사람이 업로드 가능하게 (또는 인증된 사용자만) 정책 추가
    await client.query(`
      CREATE POLICY "Pro Upload Access" 
      ON storage.objects FOR INSERT 
      WITH CHECK ( bucket_id = 'quote_images' );
    `);

    // 모든 사람이 수정 가능하게 정책 추가
    await client.query(`
      CREATE POLICY "Pro Update Access" 
      ON storage.objects FOR UPDATE 
      USING ( bucket_id = 'quote_images' );
    `);

    console.log("Bucket and policies created successfully.");
  } catch (e) {
    if (e.message.includes("already exists")) {
      console.log("Policies already exist.");
    } else {
      console.log("Error:", e.message);
    }
  } finally {
    await client.end();
  }
}

run();
