-- =============================================
-- Função SQL para desconto atômico de estoque
-- Executar no SQL Editor do Supabase:
-- https://supabase.com/dashboard → SQL Editor → New Query → Cole e Execute
-- =============================================

CREATE OR REPLACE FUNCTION atomic_stock_decrement(
  p_key TEXT,
  p_amount NUMERIC,
  p_updated_at TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current NUMERIC;
  v_new NUMERIC;
  v_result JSONB;
BEGIN
  -- UPDATE atômico: decrementa currentStock e atualiza updatedAt em uma única operação
  UPDATE kv_store_dfe23da2
  SET value = jsonb_set(
    jsonb_set(
      value,
      '{currentStock}',
      to_jsonb(GREATEST(0, COALESCE((value->>'currentStock')::numeric, 0) - p_amount))
    ),
    '{updatedAt}',
    to_jsonb(p_updated_at)
  )
  WHERE key = p_key
  RETURNING value INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Ingrediente não encontrado: %', p_key;
  END IF;

  RETURN v_result;
END;
$$;
