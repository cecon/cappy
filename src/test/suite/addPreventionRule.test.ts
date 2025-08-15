import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AddPreventionRuleCommand } from '../../commands/addPreventionRule';

suite('AddPreventionRuleCommand Tests', () => {
    let tempDir: string;
    let cappyDir: string;
    let preventionRulesPath: string;

    setup(async () => {
        // Criar diretório temporário para testes
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cappy-test-'));
        cappyDir = path.join(tempDir, '.cappy');
        preventionRulesPath = path.join(cappyDir, 'prevention-rules.xml');

        // Criar estrutura básica
        fs.mkdirSync(cappyDir, { recursive: true });
        
        // Criar arquivo prevention-rules.xml inicial
        const initialContent = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="0">
  <!-- Prevention rules will be added here -->
</prevention-rules>`;
        fs.writeFileSync(preventionRulesPath, initialContent, 'utf8');
    });

    teardown(() => {
        // Limpar diretório temporário
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should calculate correct next ID for empty rules', () => {
        const command = new AddPreventionRuleCommand();
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="0">
  <!-- Prevention rules will be added here -->
</prevention-rules>`;
        
        const nextId = (command as any).getNextId(xmlContent);
        assert.strictEqual(nextId, 1);
    });

    test('should calculate correct next ID with existing rules', () => {
        const command = new AddPreventionRuleCommand();
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="2">
  <rule id="1">
    <title>Test Rule 1</title>
    <description>Test Description 1</description>
    <category>test</category>
  </rule>
  <rule id="5">
    <title>Test Rule 2</title>
    <description>Test Description 2</description>
    <category>test</category>
  </rule>
</prevention-rules>`;
        
        const nextId = (command as any).getNextId(xmlContent);
        assert.strictEqual(nextId, 6);
    });

    test('should get correct current count', () => {
        const command = new AddPreventionRuleCommand();
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="3">
  <!-- content -->
</prevention-rules>`;
        
        const count = (command as any).getCurrentCount(xmlContent);
        assert.strictEqual(count, 3);
    });

    test('should escape XML characters correctly', () => {
        const command = new AddPreventionRuleCommand();
        const input = `Test with & < > " ' chars`;
        const expected = `Test with &amp; &lt; &gt; &quot; &apos; chars`;
        
        const result = (command as any).escapeXml(input);
        assert.strictEqual(result, expected);
    });

    test('should insert new rule correctly', () => {
        const command = new AddPreventionRuleCommand();
        const originalXml = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="0">
  <!-- Prevention rules will be added here -->
</prevention-rules>`;
        
        const newRuleXml = `  <rule id="1">
    <title>Test Rule</title>
    <description>Test Description</description>
    <category>test</category>
  </rule>`;
        
        const result = (command as any).insertNewRule(originalXml, newRuleXml, 1);
        
        assert.ok(result.includes('count="1"'));
        assert.ok(result.includes('<rule id="1">'));
        assert.ok(result.includes('<title>Test Rule</title>'));
        assert.ok(result.includes('<description>Test Description</description>'));
        assert.ok(result.includes('<category>test</category>'));
    });
});
