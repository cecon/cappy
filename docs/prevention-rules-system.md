# Prevention Rules System

## Visão Geral

O sistema de Prevention Rules permite armazenar regras que ajudam as LLMs a evitarem erros comuns durante o desenvolvimento. As regras são armazenadas em um arquivo XML estruturado que não deve ser manipulado diretamente pela LLM.

## Estrutura do Arquivo

O arquivo `prevention-rules.xml` fica localizado em `.cappy/prevention-rules.xml` e possui a seguinte estrutura:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="2">
  <rule id="1">
    <title>Evitar loops infinitos</title>
    <description>Sempre verificar condições de parada em loops</description>
    <category>performance</category>
  </rule>
  <rule id="2">
    <title>Validação de entrada</title>
    <description>Sempre validar dados de entrada do usuário</description>
    <category>security</category>
  </rule>
</prevention-rules>
```

## Comandos Disponíveis

### `cappy.addPreventionRule`
- **Título**: ➕ Cappy: Add Prevention Rule
- **Funcionalidade**: Adiciona uma nova regra de prevenção
- **Processo**: 
  1. Solicita título da regra
  2. Solicita descrição da regra
  3. Solicita categoria da regra
  4. Adiciona automaticamente com o próximo ID disponível
  5. Incrementa o count no cabeçalho
  6. Retorna no output apenas o XML da nova regra criada

### `cappy.removePreventionRule`
- **Título**: ➖ Cappy: Remove Prevention Rule
- **Funcionalidade**: Remove uma regra existente pelo ID
- **Processo**:
  1. Lista todas as regras existentes
  2. Permite seleção via QuickPick
  3. Remove a regra selecionada
  4. Atualiza o count no cabeçalho
  5. Retorna no output apenas o ID da regra removida

## Inicialização

O arquivo `prevention-rules.xml` é criado automaticamente durante o comando `cappy.init` se não existir. Ele inicia vazio com `count="0"` e um comentário indicativo.

## Características Importantes

1. **IDs únicos**: Cada regra possui um ID único que é calculado automaticamente
2. **Count automático**: O atributo `count` no cabeçalho é mantido automaticamente
3. **Escape de XML**: Caracteres especiais são automaticamente escapados
4. **Não manipulação direta**: A LLM não deve editar o arquivo diretamente
5. **Output específico**: Comandos retornam apenas o conteúdo relevante (nova regra ou ID removido)

## Casos de Uso

- Registrar erros comuns encontrados durante desenvolvimento
- Documentar boas práticas específicas do projeto
- Manter histórico de problemas recorrentes
- Orientar LLMs sobre padrões a evitar

## Testes

Os comandos possuem testes unitários completos que verificam:
- Cálculo correto de próximo ID
- Manipulação do count
- Escape/unescape de caracteres XML
- Inserção e remoção de regras
- Tratamento de arquivos vazios
