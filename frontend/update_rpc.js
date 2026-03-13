const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
    await client.connect();
    try {
        await client.query(`
      CREATE OR REPLACE FUNCTION public.send_quote_and_deduct_cash(
        p_pro_id uuid,
        p_request_id uuid,
        p_deduct_amount numeric,
        p_price numeric,
        p_description text,
        p_image_url text DEFAULT NULL::text
      ) RETURNS uuid
      LANGUAGE plpgsql
      AS $function$
      DECLARE
        v_current_cash DECIMAL;
        v_new_cash DECIMAL;
        v_quote_id UUID;
        v_quote_count INT;
        v_max_quotes INT := 5;
        v_base_price NUMERIC;
        v_actual_deduct NUMERIC;
      BEGIN
        -- Fetch dynamic base price from category
        SELECT c.base_price INTO v_base_price
        FROM Match_Requests mr
        LEFT JOIN categories c ON c.id = mr.category_id
        WHERE mr.request_id = p_request_id;
        
        -- Fallback: if category has base_price > 0, use it. Else use global/client provided amount.
        IF v_base_price IS NOT NULL AND v_base_price > 0 THEN
          v_actual_deduct := v_base_price;
        ELSE
          v_actual_deduct := p_deduct_amount;
        END IF;

        SELECT current_cash INTO v_current_cash FROM Pro_Profiles WHERE pro_id = p_pro_id FOR UPDATE;

        IF v_current_cash < v_actual_deduct THEN
          RAISE EXCEPTION '잔액이 부족합니다.';
        END IF;

        v_new_cash := v_current_cash - v_actual_deduct;

        SELECT quote_count INTO v_quote_count FROM Match_Requests WHERE request_id = p_request_id FOR UPDATE;

        IF v_quote_count >= v_max_quotes THEN
           RAISE EXCEPTION '이미 초과된 견적 요청건입니다.';
        END IF;

        UPDATE Pro_Profiles SET current_cash = v_new_cash WHERE pro_id = p_pro_id;

        INSERT INTO Cash_Ledger (pro_id, tx_type, amount, balance_snapshot, reference_id)
        VALUES (p_pro_id, 'DEDUCT_QUOTE', -v_actual_deduct, v_new_cash, p_request_id);

        INSERT INTO Match_Quotes (request_id, pro_id, cost_deducted, is_read, is_matched, price, description, image_url)
        VALUES (p_request_id, p_pro_id, v_actual_deduct, false, false, p_price, p_description, p_image_url)
        RETURNING quote_id INTO v_quote_id;

        UPDATE Match_Requests SET quote_count = quote_count + 1 WHERE request_id = p_request_id;

        RETURN v_quote_id;
      END;
      $function$;
    `);
        console.log("RPC update complete.");
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
run();
