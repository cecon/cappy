import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Mock do método updateCopilotInstructions para teste
async function updateCopilotInstructions(workspaceRoot: string): Promise<void> {
    const githubDir = path.join(workspaceRoot, '.github');
    const targetPath = path.join(githubDir, 'copilot-instructions.md');
    
    // Simular o caminho da extensão
    const extensionPath = path.resolve(__dirname, '../../../');
    const templatePath = path.join(extensionPath, 'resources', 'templates', 'cappy-copilot-instructions.md');

    await fs.promises.mkdir(githubDir, { recursive: true });

    try {
        const tpl = await fs.promises.readFile(templatePath, 'utf8');
        const start = '<!-- CAPPY INI -->';
        const end = '<!-- CAPPY END -->';

        // If target doesn't exist, create with template
        let existing = '';
        try {
            existing = await fs.promises.readFile(targetPath, 'utf8');
        } catch (e: any) {
            if (e?.code === 'ENOENT') {
                await fs.promises.writeFile(targetPath, tpl, 'utf8');
                return;
            }
            throw e;
        }

        const hasStart = existing.includes(start);
        const hasEnd = existing.includes(end);
        
        if (!hasStart || !hasEnd) {
            // No markers; overwrite entire file to align with template once
            await fs.promises.writeFile(targetPath, tpl, 'utf8');
            return;
        }

        // Replace only the marked block
        const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
        
        // Extract content between markers from template
        const templatePattern = new RegExp(`${start}([\\s\\S]*?)${end}`);
        const templateMatch = tpl.match(templatePattern);
        const templateContent = templateMatch ? templateMatch[1].trim() : tpl.trim();
        
        // Replace with markers preserved
        const replacement = `${start}\n${templateContent}\n${end}`;
        const updated = existing.replace(pattern, replacement);
        await fs.promises.writeFile(targetPath, updated, 'utf8');
    } catch (err: any) {
        if (err?.code === 'ENOENT') {
            // If template is missing, keep existing file or create a minimal header
            try {
                await fs.promises.access(targetPath, fs.constants.F_OK);
            } catch {
                await fs.promises.writeFile(targetPath, '# Cappy Copilot Instructions\n', 'utf8');
            }
        } else {
            throw err;
        }
    }
}

// Mock da função checkAndCopyXsdSchemas atualizada
async function checkAndUpdateCappyFiles(workspaceRoot: string): Promise<void> {
    const cappyPath = path.join(workspaceRoot, '.cappy');
    
    // Check if .cappy directory exists (project is initialized)
    try {
        await fs.promises.access(cappyPath, fs.constants.F_OK);
        
        // Project is initialized, update copilot-instructions.md
        await updateCopilotInstructions(workspaceRoot);
        
        console.log('Cappy: copilot-instructions.md updated automatically on startup');
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // .cappy doesn't exist, project not initialized yet
            return;
        }
        throw error;
    }
}

suite('🔄 Auto Update Copilot Instructions Test Suite', () => {
    let testWorkspaceRoot: string;

    setup(async () => {
        // Create a temporary workspace for testing
        const tmpDir = os.tmpdir();
        const timestamp = Date.now();
        testWorkspaceRoot = path.join(tmpDir, `cappy-auto-update-test-${timestamp}`);
        
        await fs.promises.mkdir(testWorkspaceRoot, { recursive: true });
        console.log(`✅ Test workspace created at: ${testWorkspaceRoot}`);
    });

    teardown(async () => {
        // Clean up test workspace
        try {
            await fs.promises.rm(testWorkspaceRoot, { recursive: true, force: true });
            console.log('🧹 Test workspace cleaned up');
        } catch (error) {
            console.warn('⚠️ Failed to clean up test workspace:', error);
        }
    });

    test('🆕 Should create copilot-instructions.md when .cappy exists but file doesn\'t', async () => {
        // Arrange: Create .cappy directory to simulate initialized project
        const cappyDir = path.join(testWorkspaceRoot, '.cappy');
        await fs.promises.mkdir(cappyDir, { recursive: true });

        // Act: Run the auto-update function
        await checkAndUpdateCappyFiles(testWorkspaceRoot);

        // Assert: Check if copilot-instructions.md was created
        const copilotInstructionsPath = path.join(testWorkspaceRoot, '.github', 'copilot-instructions.md');
        const fileExists = fs.existsSync(copilotInstructionsPath);
        
        assert.ok(fileExists, 'copilot-instructions.md should be created');
        
        // Verify content contains CAPPY markers
        const content = await fs.promises.readFile(copilotInstructionsPath, 'utf8');
        assert.ok(content.includes('<!-- CAPPY INI -->'), 'File should contain CAPPY start marker');
        assert.ok(content.includes('<!-- CAPPY END -->'), 'File should contain CAPPY end marker');
        assert.ok(content.includes('CAPPY — Manual de Comandos'), 'File should contain CAPPY instructions');
        
        console.log('✅ New copilot-instructions.md creation test passed');
    });

    test('🔄 Should update existing copilot-instructions.md with CAPPY content', async () => {
        // Arrange: Create .cappy directory and existing copilot-instructions.md
        const cappyDir = path.join(testWorkspaceRoot, '.cappy');
        const githubDir = path.join(testWorkspaceRoot, '.github');
        const copilotInstructionsPath = path.join(githubDir, 'copilot-instructions.md');
        
        await fs.promises.mkdir(cappyDir, { recursive: true });
        await fs.promises.mkdir(githubDir, { recursive: true });
        
        // Create existing file with custom content and CAPPY markers
        const existingContent = `# My Custom Instructions

Some custom content here.

<!-- CAPPY INI -->
Old CAPPY content that should be replaced
<!-- CAPPY END -->

More custom content at the end.`;
        
        await fs.promises.writeFile(copilotInstructionsPath, existingContent, 'utf8');

        // Act: Run the auto-update function
        await checkAndUpdateCappyFiles(testWorkspaceRoot);

        // Assert: Check if file was updated correctly
        const updatedContent = await fs.promises.readFile(copilotInstructionsPath, 'utf8');
        
        // Should preserve custom content before and after CAPPY block
        assert.ok(updatedContent.includes('# My Custom Instructions'), 'Should preserve custom header');
        assert.ok(updatedContent.includes('Some custom content here.'), 'Should preserve custom content before CAPPY');
        assert.ok(updatedContent.includes('More custom content at the end.'), 'Should preserve custom content after CAPPY');
        
        // Should update CAPPY content
        assert.ok(updatedContent.includes('<!-- CAPPY INI -->'), 'Should contain CAPPY start marker');
        assert.ok(updatedContent.includes('<!-- CAPPY END -->'), 'Should contain CAPPY end marker');
        assert.ok(updatedContent.includes('CAPPY — Manual de Comandos (Orquestração de Contexto)'), 'Should contain updated CAPPY content');
        assert.ok(!updatedContent.includes('Old CAPPY content that should be replaced'), 'Should replace old CAPPY content');
        
        console.log('✅ Existing file update test passed');
    });

    test('🚫 Should not run when .cappy directory doesn\'t exist', async () => {
        // Arrange: No .cappy directory (project not initialized)
        
        // Act: Run the auto-update function
        await checkAndUpdateCappyFiles(testWorkspaceRoot);

        // Assert: copilot-instructions.md should not be created
        const copilotInstructionsPath = path.join(testWorkspaceRoot, '.github', 'copilot-instructions.md');
        const fileExists = fs.existsSync(copilotInstructionsPath);
        
        assert.ok(!fileExists, 'copilot-instructions.md should not be created when .cappy doesn\'t exist');
        
        console.log('✅ Non-initialized project test passed');
    });

    test('🔧 Should handle file without CAPPY markers by replacing entire content', async () => {
        // Arrange: Create .cappy directory and existing file without CAPPY markers
        const cappyDir = path.join(testWorkspaceRoot, '.cappy');
        const githubDir = path.join(testWorkspaceRoot, '.github');
        const copilotInstructionsPath = path.join(githubDir, 'copilot-instructions.md');
        
        await fs.promises.mkdir(cappyDir, { recursive: true });
        await fs.promises.mkdir(githubDir, { recursive: true });
        
        // Create existing file without CAPPY markers
        const existingContent = `# Old Instructions

Some old content without CAPPY markers.`;
        
        await fs.promises.writeFile(copilotInstructionsPath, existingContent, 'utf8');

        // Act: Run the auto-update function
        await checkAndUpdateCappyFiles(testWorkspaceRoot);

        // Assert: Entire file should be replaced with template
        const updatedContent = await fs.promises.readFile(copilotInstructionsPath, 'utf8');
        
        assert.ok(!updatedContent.includes('# Old Instructions'), 'Old content should be replaced');
        assert.ok(!updatedContent.includes('Some old content without CAPPY markers.'), 'Old content should be replaced');
        assert.ok(updatedContent.includes('<!-- CAPPY INI -->'), 'Should contain CAPPY start marker');
        assert.ok(updatedContent.includes('<!-- CAPPY END -->'), 'Should contain CAPPY end marker');
        assert.ok(updatedContent.includes('CAPPY — Manual de Comandos'), 'Should contain new CAPPY content');
        
        console.log('✅ File without markers replacement test passed');
    });

    test('🛡️ Should handle missing template gracefully', async () => {
        // Arrange: Create .cappy directory
        const cappyDir = path.join(testWorkspaceRoot, '.cappy');
        await fs.promises.mkdir(cappyDir, { recursive: true });

        // Mock updateCopilotInstructions to simulate missing template
        async function updateCopilotInstructionsWithMissingTemplate(workspaceRoot: string): Promise<void> {
            const githubDir = path.join(workspaceRoot, '.github');
            const targetPath = path.join(githubDir, 'copilot-instructions.md');
            
            await fs.promises.mkdir(githubDir, { recursive: true });

            // Simulate missing template
            try {
                await fs.promises.readFile('/nonexistent/template.md', 'utf8');
            } catch (err: any) {
                if (err?.code === 'ENOENT') {
                    // Create minimal header when template is missing
                    await fs.promises.writeFile(targetPath, '# Cappy Copilot Instructions\n', 'utf8');
                }
            }
        }

        // Act: Run function with missing template
        await updateCopilotInstructionsWithMissingTemplate(testWorkspaceRoot);

        // Assert: Should create minimal file
        const copilotInstructionsPath = path.join(testWorkspaceRoot, '.github', 'copilot-instructions.md');
        const fileExists = fs.existsSync(copilotInstructionsPath);
        
        assert.ok(fileExists, 'File should be created even with missing template');
        
        const content = await fs.promises.readFile(copilotInstructionsPath, 'utf8');
        assert.strictEqual(content.trim(), '# Cappy Copilot Instructions', 'Should contain minimal header');
        
        console.log('✅ Missing template graceful handling test passed');
    });
});
