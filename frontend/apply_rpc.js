const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env.local', 'utf-8');
const connectionString = env.split('\n').find(l => l.startsWith('DIRECT_URL')).split('=')[1].trim().replace(/^"|"$/g, '');

const sql = `
DROP FUNCTION IF EXISTS send_quote_and_deduct_cash(uuid, uuid, numeric);
DROP FUNCTION IF EXISTS send_quote_and_deduct_cash(uuid, uuid, numeric, numeric, text, text);

CREATE OR REPLACE FUNCTION send_quote_and_deduct_cash(
  p_pro_id UUID,
  p_request_id UUID,
  p_deduct_amount DECIMAL,
  p_price DECIMAL,
  p_description TEXT,
  p_image_url TEXT
) RETURNS UUID AS $$
DECLARE
  v_current_cash DECIMAL;
  v_new_cash DECIMAL;
  v_quote_id UUID;
  v_quote_count INT;
  v_max_quotes INT := 5; 
BEGIN
  SELECT current_cash INTO v_current_cash FROM Pro_Profiles WHERE pro_id = p_pro_id FOR UPDATE;

  IF v_current_cash < p_deduct_amount THEN
    RAISE EXCEPTION '잔액이 부족합니다.';
  END IF;

  v_new_cash := v_current_cash - p_deduct_amount;

  SELECT quote_count INTO v_quote_count FROM Match_Requests WHERE request_id = p_request_id FOR UPDATE;

  IF v_quote_count >= v_max_quotes THEN
     RAISE EXCEPTION '이미 초과된 견적 요청건입니다.';
  END IF;

  UPDATE Pro_Profiles SET current_cash = v_new_cash WHERE pro_id = p_pro_id;

  INSERT INTO Cash_Ledger (pro_id, tx_type, amount, balance_snapshot, reference_id)
  VALUES (p_pro_id, 'DEDUCT_QUOTE', -p_deduct_amount, v_new_cash, p_request_id);

  INSERT INTO Match_Quotes (request_id, pro_id, cost_deducted, is_read, is_matched, price, description, image_url)
  VALUES (p_request_id, p_pro_id, p_deduct_amount, false, false, p_price, p_description, p_image_url)
  RETURNING quote_id INTO v_quote_id;

  UPDATE Match_Requests SET quote_count = quote_count + 1 WHERE request_id = p_request_id;

  RETURN v_quote_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function migrate() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to DB');
        await client.query(sql);
        console.log('RPC update completed successfully');
    } catch (err) {
        console.error('RPC update failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
