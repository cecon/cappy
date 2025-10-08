// Cappy Agent Chat JavaScript
(function() {
    const vscode = acquireVsCodeApi();
    
    let currentContext = [];
    let selectedModel = 'gpt-4';
    let availableTools = [];

    // DOM Elements
    const promptInput = document.getElementById('promptInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatArea = document.getElementById('chatArea');
    const modelSelect = document.getElementById('modelSelect');
    const contextIndicator = document.getElementById('contextIndicator');
    const contextPills = document.getElementById('contextPills');
    const attachContext = document.getElementById('attachContext');
    const useTools = document.getElementById('useTools');
    const toolsPanel = document.getElementById('toolsPanel');
    const closeTools = document.getElementById('closeTools');

    // Event Listeners
    sendBtn.addEventListener('click', handleSend);
    attachContext.addEventListener('click', handleAttachContext);
    useTools.addEventListener('click', toggleToolsPanel);
    closeTools.addEventListener('click', () => toolsPanel.style.display = 'none');
    
    modelSelect.addEventListener('change', (e) => {
        selectedModel = e.target.value;
        updateModelStatus();
    });
    
    // Allow Enter to submit (Ctrl+Enter for new line)
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Tool selection
    document.addEventListener('click', (e) => {
        if (e.target.closest('.tool-item')) {
            const toolItem = e.target.closest('.tool-item');
            const toolName = toolItem.dataset.tool;
            selectTool(toolName);
        }
    });

    // Handle messages from extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'agentResponse':
                handleAgentResponse(message.data);
                break;
            case 'contextUpdate':
                handleContextUpdate(message.context);
                break;
            case 'toolsUpdate':
                handleToolsUpdate(message.tools);
                break;
            case 'modelsList':
                handleModelsUpdate(message.models);
                break;
            case 'error':
                handleError(message.message);
                break;
        }
    });

    function handleSend() {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            showError('Please enter a message first.');
            return;
        }

        // Add user message to chat
        addMessage(prompt, 'user');
        
        // Clear input
        promptInput.value = '';
        
        // Show loading state
        setLoading(true);
        addMessage('� Thinking...', 'assistant', true);
        
        // Send request to extension with full context
        vscode.postMessage({
            type: 'agentQuery',
            prompt: prompt,
            model: selectedModel,
            context: currentContext,
            tools: availableTools
        });
    }

    function handleAgentResponse(response) {
        setLoading(false);
        
        // Remove loading message
        removeLoadingMessage();
        
        // Add agent response
        addMessage(response.content, 'assistant');
        
        // Handle any tool results
        if (response.toolResults) {
            response.toolResults.forEach(result => {
                addToolResult(result);
            });
        }
        
        // Update context if changed
        if (response.newContext) {
            updateContext(response.newContext);
        }
    }

    function handleAttachContext() {
        // Request available context from extension
        vscode.postMessage({
            type: 'requestContext'
        });
    }

    function handleContextUpdate(context) {
        currentContext = context;
        renderContextPills();
        updateContextIndicator();
    }

    function handleToolsUpdate(tools) {
        availableTools = tools;
        renderToolsPanel();
    }

    function handleModelsUpdate(models) {
        updateModelDropdown(models);
    }

    function toggleToolsPanel() {
        const isVisible = toolsPanel.style.display !== 'none';
        toolsPanel.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            // Request available tools
            vscode.postMessage({
                type: 'requestTools'
            });
        }
    }

    function selectTool(toolName) {
        // Add tool reference to input
        const currentValue = promptInput.value;
        const toolRef = `@${toolName} `;
        
        if (!currentValue.includes(toolRef)) {
            promptInput.value = toolRef + currentValue;
        }
        
        toolsPanel.style.display = 'none';
        promptInput.focus();
    }

    function renderContextPills() {
        contextPills.innerHTML = '';
        
        currentContext.forEach((item, index) => {
            const pill = document.createElement('div');
            pill.className = 'context-pill';
            pill.innerHTML = `
                <span>${getContextIcon(item.type)} ${item.name}</span>
                <span class="remove-context" data-index="${index}">×</span>
            `;
            
            pill.querySelector('.remove-context').addEventListener('click', (e) => {
                e.stopPropagation();
                removeContext(index);
            });
            
            contextPills.appendChild(pill);
        });
    }

    function getContextIcon(type) {
        const icons = {
            file: '📄',
            task: '📝',
            project: '📁',
            search: '🔍',
            prevention: '🛡️'
        };
        return icons[type] || '📎';
    }

    function removeContext(index) {
        currentContext.splice(index, 1);
        renderContextPills();
        updateContextIndicator();
    }

    function updateContext(newContext) {
        currentContext = [...currentContext, ...newContext];
        renderContextPills();
        updateContextIndicator();
    }

    function updateContextIndicator() {
        const count = currentContext.length;
        if (count > 0) {
            contextIndicator.textContent = `📄 ${count} Context Item${count > 1 ? 's' : ''}`;
            contextIndicator.classList.add('active');
        } else {
            contextIndicator.textContent = '📄 No Context';
            contextIndicator.classList.remove('active');
        }
    }

    function renderToolsPanel() {
        const toolsGrid = document.querySelector('.tools-grid');
        if (!toolsGrid) {
            return;
        }
        
        toolsGrid.innerHTML = '';
        
        availableTools.forEach(tool => {
            const toolItem = document.createElement('div');
            toolItem.className = 'tool-item';
            toolItem.dataset.tool = tool.name;
            toolItem.innerHTML = `
                <span class="tool-icon">${tool.icon}</span>
                <span class="tool-name">${tool.displayName}</span>
            `;
            toolsGrid.appendChild(toolItem);
        });
    }

    function updateModelDropdown(models) {
        modelSelect.innerHTML = '';
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            option.selected = model.id === selectedModel;
            modelSelect.appendChild(option);
        });
    }

    function updateModelStatus() {
        // Could add model-specific status indicators here
        console.log(`Model changed to: ${selectedModel}`);
    }

    function addMessage(content, type, isLoading = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        if (isLoading) {
            messageDiv.classList.add('loading-message');
        }
        
        messageDiv.innerHTML = `
            <div class="message-content">${escapeHtml(content)}</div>
        `;
        
        chatArea.appendChild(messageDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function addToolResult(result) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'message assistant';
        resultDiv.innerHTML = `
            <div class="message-content">
                <strong>🛠️ Tool: ${result.toolName}</strong><br>
                <pre>${escapeHtml(JSON.stringify(result.data, null, 2))}</pre>
            </div>
        `;
        
        chatArea.appendChild(resultDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function removeLoadingMessage() {
        const loadingMessages = chatArea.querySelectorAll('.loading-message');
        loadingMessages.forEach(msg => msg.remove());
    }

    function setLoading(loading) {
        sendBtn.disabled = loading;
        if (loading) {
            sendBtn.innerHTML = '<span class="btn-icon">⏳</span>Thinking...';
        } else {
            sendBtn.innerHTML = '<span class="btn-icon">🚀</span>Send';
        }
    }

    function handleError(message) {
        setLoading(false);
        removeLoadingMessage();
        showError(message);
    }

    function showError(message) {
        addMessage(`❌ ${message}`, 'assistant');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize
    console.log('🦫 Cappy Agent initialized');
    promptInput.focus();
    
    // Request initial data
    vscode.postMessage({ type: 'requestInitialData' });
})();