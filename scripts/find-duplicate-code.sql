-- ============================================================
-- QUERIES PARA DETECTAR CÓDIGO DUPLICADO NO CAPPY DATABASE
-- ============================================================
-- Execute com: sqlite3 .cappy/cappy.db < scripts/find-duplicate-code.sql
-- ============================================================

.mode column
.headers on
.width 40 20 10 10

-- ============================================================
-- 1. DETECTAR FUNÇÕES/CLASSES COM MESMO NOME
-- ============================================================
SELECT 
  '=== ENTIDADES DUPLICADAS (MESMO NOME) ===' as title;

SELECT 
  n.label as nome,
  n.type as tipo,
  COUNT(*) as ocorrencias,
  GROUP_CONCAT(DISTINCT n.file_path, ', ') as arquivos
FROM nodes n
WHERE 
  n.type IN ('code_chunk', 'entity', 'chunk')
  AND n.symbol_name IS NOT NULL
  AND n.status = 'active'
GROUP BY n.symbol_name, n.symbol_kind
HAVING COUNT(*) > 1
ORDER BY ocorrencias DESC;

-- ============================================================
-- 2. DETECTAR CÓDIGO COM HASH IDÊNTICO (DUPLICATA EXATA)
-- ============================================================
SELECT 
  '=== CÓDIGO DUPLICADO EXATO (HASH IDÊNTICO) ===' as title;

SELECT 
  n.content_hash as hash,
  COUNT(*) as ocorrencias,
  GROUP_CONCAT(n.file_path || ':' || n.line_start, '\n  ') as localizacoes,
  n.symbol_name as simbolo,
  LENGTH(COALESCE(n.extra_metadata, '{}')) as tamanho_aprox
FROM nodes n
WHERE 
  n.content_hash IS NOT NULL
  AND n.type IN ('code_chunk', 'chunk')
  AND n.status = 'active'
GROUP BY n.content_hash
HAVING COUNT(*) > 1
ORDER BY ocorrencias DESC
LIMIT 20;

-- ============================================================
-- 3. DETECTAR IMPORTS DUPLICADOS NO MESMO ARQUIVO
-- ============================================================
SELECT 
  '=== IMPORTS DUPLICADOS POR ARQUIVO ===' as title;

SELECT 
  n.file_path as arquivo,
  n.source as pacote_importado,
  COUNT(*) as vezes_importado,
  GROUP_CONCAT(n.line_start, ', ') as linhas
FROM nodes n
WHERE 
  n.type = 'entity'
  AND n.entity_type = 'import'
  AND n.file_path IS NOT NULL
  AND n.status = 'active'
GROUP BY n.file_path, n.source
HAVING COUNT(*) > 1
ORDER BY vezes_importado DESC;

-- ============================================================
-- 4. DETECTAR FUNÇÕES SIMILARES (MESMO NOME, DIFERENTES ARQUIVOS)
-- ============================================================
SELECT 
  '=== FUNÇÕES COM MESMO NOME EM ARQUIVOS DIFERENTES ===' as title;

SELECT 
  n.symbol_name as funcao,
  COUNT(DISTINCT n.file_path) as num_arquivos,
  COUNT(*) as total_ocorrencias,
  GROUP_CONCAT(DISTINCT n.file_path, '\n  ') as arquivos
FROM nodes n
WHERE 
  n.symbol_name IS NOT NULL
  AND n.symbol_kind IN ('function', 'method', 'arrow_function')
  AND n.status = 'active'
GROUP BY n.symbol_name
HAVING COUNT(DISTINCT n.file_path) > 1
ORDER BY num_arquivos DESC, total_ocorrencias DESC
LIMIT 30;

-- ============================================================
-- 5. DETECTAR CLASSES DUPLICADAS
-- ============================================================
SELECT 
  '=== CLASSES COM MESMO NOME ===' as title;

SELECT 
  n.symbol_name as classe,
  COUNT(*) as ocorrencias,
  GROUP_CONCAT(n.file_path || ' (linha ' || n.line_start || ')', '\n  ') as localizacoes
FROM nodes n
WHERE 
  n.symbol_kind = 'class'
  AND n.symbol_name IS NOT NULL
  AND n.status = 'active'
GROUP BY n.symbol_name
HAVING COUNT(*) > 1
ORDER BY ocorrencias DESC;

-- ============================================================
-- 6. DETECTAR CÓDIGO POR SIMILARIDADE DE CONTEÚDO (VIA VECTORS)
-- ============================================================
SELECT 
  '=== TOP 20 CHUNKS COM CONTEÚDO MAIS SIMILAR ===' as title;

-- Esta query encontra chunks que têm vetores similares
-- (indica que o código pode ser duplicado semanticamente)
SELECT 
  v1.chunk_id as chunk_1,
  v2.chunk_id as chunk_2,
  LENGTH(v1.content) as tamanho_1,
  LENGTH(v2.content) as tamanho_2,
  SUBSTR(v1.content, 1, 50) || '...' as preview_1,
  SUBSTR(v2.content, 1, 50) || '...' as preview_2
FROM vectors v1
JOIN vectors v2 ON v1.chunk_id < v2.chunk_id
WHERE 
  -- Conteúdo similar (primeiros 100 chars iguais)
  SUBSTR(v1.content, 1, 100) = SUBSTR(v2.content, 1, 100)
  AND LENGTH(v1.content) > 100
  AND LENGTH(v2.content) > 100
ORDER BY LENGTH(v1.content) DESC
LIMIT 20;

-- ============================================================
-- 7. ESTATÍSTICAS GERAIS DE DUPLICAÇÃO
-- ============================================================
SELECT 
  '=== ESTATÍSTICAS DE DUPLICAÇÃO ===' as title;

SELECT 
  'Total de nodes' as metrica,
  COUNT(*) as valor
FROM nodes
WHERE status = 'active'
UNION ALL
SELECT 
  'Nodes com content_hash',
  COUNT(*)
FROM nodes
WHERE content_hash IS NOT NULL AND status = 'active'
UNION ALL
SELECT 
  'Hashes únicos',
  COUNT(DISTINCT content_hash)
FROM nodes
WHERE content_hash IS NOT NULL AND status = 'active'
UNION ALL
SELECT 
  'Hashes duplicados',
  COUNT(*)
FROM (
  SELECT content_hash
  FROM nodes
  WHERE content_hash IS NOT NULL AND status = 'active'
  GROUP BY content_hash
  HAVING COUNT(*) > 1
)
UNION ALL
SELECT 
  'Símbolos duplicados',
  COUNT(*)
FROM (
  SELECT symbol_name
  FROM nodes
  WHERE symbol_name IS NOT NULL AND status = 'active'
  GROUP BY symbol_name
  HAVING COUNT(*) > 1
);

-- ============================================================
-- 8. DETECTAR CÓDIGO DUPLICADO POR TAMANHO E LINGUAGEM
-- ============================================================
SELECT 
  '=== DUPLICAÇÃO POR LINGUAGEM ===' as title;

SELECT 
  n.language as linguagem,
  COUNT(*) as total_chunks,
  SUM(CASE WHEN dup.content_hash IS NOT NULL THEN 1 ELSE 0 END) as chunks_duplicados,
  ROUND(
    100.0 * SUM(CASE WHEN dup.content_hash IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as percentual_duplicacao
FROM nodes n
LEFT JOIN (
  SELECT content_hash
  FROM nodes
  WHERE content_hash IS NOT NULL AND status = 'active'
  GROUP BY content_hash
  HAVING COUNT(*) > 1
) dup ON n.content_hash = dup.content_hash
WHERE 
  n.type IN ('code_chunk', 'chunk')
  AND n.status = 'active'
  AND n.language IS NOT NULL
GROUP BY n.language
ORDER BY percentual_duplicacao DESC;

-- ============================================================
-- 9. DETECTAR ARQUIVOS COM MAIS DUPLICAÇÃO INTERNA
-- ============================================================
SELECT 
  '=== ARQUIVOS COM MAIS CÓDIGO DUPLICADO INTERNO ===' as title;

SELECT 
  n.file_path as arquivo,
  COUNT(DISTINCT n.symbol_name) as simbolos_unicos,
  COUNT(*) as total_simbolos,
  COUNT(*) - COUNT(DISTINCT n.symbol_name) as simbolos_duplicados,
  ROUND(
    100.0 * (COUNT(*) - COUNT(DISTINCT n.symbol_name)) / COUNT(*),
    2
  ) as percentual_duplicacao
FROM nodes n
WHERE 
  n.file_path IS NOT NULL
  AND n.symbol_name IS NOT NULL
  AND n.status = 'active'
GROUP BY n.file_path
HAVING COUNT(*) > 5 AND percentual_duplicacao > 0
ORDER BY simbolos_duplicados DESC
LIMIT 20;

-- ============================================================
-- 10. BUSCAR PADRÕES DE CÓDIGO REPETIDO (ANTI-PATTERNS)
-- ============================================================
SELECT 
  '=== POTENCIAIS ANTI-PATTERNS (FUNÇÕES MUITO SIMILARES) ===' as title;

SELECT 
  CASE 
    WHEN symbol_name LIKE 'get%' THEN 'Getters'
    WHEN symbol_name LIKE 'set%' THEN 'Setters'
    WHEN symbol_name LIKE 'handle%' THEN 'Handlers'
    WHEN symbol_name LIKE 'on%' THEN 'Event Handlers'
    WHEN symbol_name LIKE 'create%' THEN 'Creators/Factories'
    WHEN symbol_name LIKE 'update%' THEN 'Updaters'
    WHEN symbol_name LIKE 'delete%' THEN 'Deleters'
    WHEN symbol_name LIKE 'validate%' THEN 'Validators'
    ELSE 'Outros'
  END as padrao,
  COUNT(*) as ocorrencias,
  COUNT(DISTINCT file_path) as arquivos_diferentes,
  GROUP_CONCAT(DISTINCT symbol_name, ', ') as exemplos
FROM nodes
WHERE 
  symbol_kind IN ('function', 'method')
  AND symbol_name IS NOT NULL
  AND status = 'active'
GROUP BY padrao
HAVING ocorrencias > 3
ORDER BY ocorrencias DESC;
