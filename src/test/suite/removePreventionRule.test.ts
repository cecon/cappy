import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RemovePreventionRuleCommand } from '../../commands/removePreventionRule';

suite('RemovePreventionRuleCommand Tests', () => {
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
    });

    teardown(() => {
        // Limpar diretório temporário
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should extract existing rules correctly', () => {
        const command = new RemovePreventionRuleCommand();
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="2">
  <rule id="1">
    <title>Test Rule 1</title>
    <description>Test Description 1</description>
    <category>test</category>
  </rule>
  <rule id="2">
    <title>Test Rule &amp; Special</title>
    <description>Test Description &lt;special&gt;</description>
    <category>test</category>
  </rule>
</prevention-rules>`;
        
        const rules = (command as any).extractExistingRules(xmlContent);
        
        assert.strictEqual(rules.length, 2);
        assert.strictEqual(rules[0].id, '1');
        assert.strictEqual(rules[0].title, 'Test Rule 1');
        assert.strictEqual(rules[0].description, 'Test Description 1');
        
        assert.strictEqual(rules[1].id, '2');
        assert.strictEqual(rules[1].title, 'Test Rule & Special');
        assert.strictEqual(rules[1].description, 'Test Description <special>');
    });

    test('should remove rule from XML correctly', () => {
        const command = new RemovePreventionRuleCommand();
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="3">
  <rule id="1">
    <title>Test Rule 1</title>
    <description>Test Description 1</description>
    <category>test</category>
  </rule>
  <rule id="2">
    <title>Test Rule 2</title>
    <description>Test Description 2</description>
    <category>test</category>
  </rule>
  <rule id="3">
    <title>Test Rule 3</title>
    <description>Test Description 3</description>
    <category>test</category>
  </rule>
</prevention-rules>`;
        
        const result = (command as any).removeRuleFromXml(xmlContent, '2');
        
        assert.ok(result.includes('count="2"'));
        assert.ok(result.includes('<rule id="1">'));
        assert.ok(result.includes('<rule id="3">'));
        assert.ok(!result.includes('<rule id="2">'));
        assert.ok(!result.includes('Test Rule 2'));
    });

    test('should get correct current count', () => {
        const command = new RemovePreventionRuleCommand();
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="5">
  <!-- content -->
</prevention-rules>`;
        
        const count = (command as any).getCurrentCount(xmlContent);
        assert.strictEqual(count, 5);
    });

    test('should unescape XML characters correctly', () => {
        const command = new RemovePreventionRuleCommand();
        const input = `Test with &amp; &lt; &gt; &quot; &apos; chars`;
        const expected = `Test with & < > " ' chars`;
        
        const result = (command as any).unescapeXml(input);
        assert.strictEqual(result, expected);
    });

    test('should handle empty rules list', () => {
        const command = new RemovePreventionRuleCommand();
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<prevention-rules count="0">
  <!-- Prevention rules will be added here -->
</prevention-rules>`;
        
        const rules = (command as any).extractExistingRules(xmlContent);
        assert.strictEqual(rules.length, 0);
    });
});
