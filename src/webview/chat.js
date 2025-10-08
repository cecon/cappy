// Cappy Chat - GitHub Copilot Style// Cappy Chat - GitHub Copilot Style// Cappy Chat - GitHub Copilot Style// Cappy Chat - GitHub Copilot Style

(function() {

    const vscode = acquireVsCodeApi();(function() {

    

    let currentContext = [];    const vscode = acquireVsCodeApi();(function() {(function() {

    let selectedModel = 'gpt-4';

    let conversationHistory = [];    



    // Initialize when DOM is ready    let currentContext = [];    const vscode = acquireVsCodeApi();    const vscode = acquireVsCodeApi();

    document.addEventListener('DOMContentLoaded', function() {

        initializeChat();    let selectedModel = 'gpt-4';

    });

    let isModelDropdownOpen = false;        

    // If DOM is already loaded

    if (document.readyState === 'loading') {    let conversationHistory = [];

        document.addEventListener('DOMContentLoaded', initializeChat);

    } else {    let currentContext = [];    let currentContext = [];

        initializeChat();

    }    // DOM Elements



    function initializeChat() {    const chatInput = document.getElementById('chatInput');    let selectedModel = 'gpt-4';    let selectedModel = 'gpt-4';

        const chatInput = document.getElementById('chatInput');

        const sendButton = document.getElementById('sendButton');    const sendButton = document.getElementById('sendButton');

        const chatMessages = document.getElementById('chatMessages');

        const modelButton = document.getElementById('modelButton');    const chatMessages = document.getElementById('chatMessages');    let isModelDropdownOpen = false;    let isModelDropdownOpen = false;

        const attachButton = document.getElementById('attachButton');

        const toolsButton = document.getElementById('toolsButton');    const modelButton = document.getElementById('modelButton');



        if (!chatInput || !sendButton) {    const modelDropdown = document.getElementById('modelDropdown');    let conversationHistory = [];    let conversationHistory = [];

            console.log('Chat elements not found, retrying in 100ms...');

            setTimeout(initializeChat, 100);    const modelName = document.getElementById('modelName');

            return;

        }    const attachButton = document.getElementById('attachButton');



        console.log('🦫 Cappy Chat initialized');    const toolsButton = document.getElementById('toolsButton');



        // Event Listeners    const charCount = document.getElementById('charCount');    // DOM Elements    // DOM Elements

        sendButton.addEventListener('click', handleSend);

        chatInput.addEventListener('keydown', function(e) {    const contextInfo = document.getElementById('contextInfo');

            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {

                e.preventDefault();    const chatAttachments = document.getElementById('chatAttachments');    const chatInput = document.getElementById('chatInput');    const chatInput = document.getElementById('chatInput');

                handleSend();

            }    const toolsPanel = document.getElementById('toolsPanel');

        });

    const attachPanel = document.getElementById('attachPanel');    const sendButton = document.getElementById('sendButton');    const sendButton = document.getElementById('sendButton');

        chatInput.addEventListener('input', function() {

            updateSendButton();    const closeTools = document.getElementById('closeTools');

            updateCharCount();

        });    const closeAttach = document.getElementById('closeAttach');    const chatMessages = document.getElementById('chatMessages');    const chatMessages = document.getElementById('chatMessages');



        if (modelButton) {

            modelButton.addEventListener('click', toggleModelDropdown);

        }    // Event Listeners    const modelButton = document.getElementById('modelButton');    const modelButton = document.getElementById('modelButton');



        if (attachButton) {    sendButton.addEventListener('click', handleSend);

            attachButton.addEventListener('click', toggleAttachPanel);

        }    attachButton.addEventListener('click', toggleAttachPanel);    const modelDropdown = document.getElementById('modelDropdown');    const modelDropdown = document.getElementById('modelDropdown');



        if (toolsButton) {    toolsButton.addEventListener('click', toggleToolsPanel);

            toolsButton.addEventListener('click', toggleToolsPanel);

        }    modelButton.addEventListener('click', toggleModelDropdown);    const modelName = document.getElementById('modelName');    const modelName = document.getElementById('modelName');



        // Quick actions    closeTools.addEventListener('click', () => hidePanel('tools'));

        document.addEventListener('click', function(e) {

            if (e.target.closest('.quick-action')) {    closeAttach.addEventListener('click', () => hidePanel('attach'));    const attachButton = document.getElementById('attachButton');    const attachButton = document.getElementById('attachButton');

                const action = e.target.closest('.quick-action').dataset.action;

                handleQuickAction(action);    

            }

        });    // Input handling    const toolsButton = document.getElementById('toolsButton');    const toolsButton = document.getElementById('toolsButton');



        chatInput.focus();    chatInput.addEventListener('input', handleInputChange);

        updateSendButton();

    }    chatInput.addEventListener('keydown', handleKeyDown);    const charCount = document.getElementById('charCount');    const charCount = document.getElementById('charCount');



    function handleSend() {    

        const chatInput = document.getElementById('chatInput');

        const message = chatInput.value.trim();    // Quick actions and dropdowns    const contextInfo = document.getElementById('contextInfo');    const contextInfo = document.getElementById('contextInfo');

        if (!message) return;

    document.addEventListener('click', (e) => {

        clearWelcome();

        addMessage(message, 'user');        if (e.target.closest('.quick-action')) {    const chatAttachments = document.getElementById('chatAttachments');    const chatAttachments = document.getElementById('chatAttachments');

        

        chatInput.value = '';            const action = e.target.closest('.quick-action').dataset.action;

        updateSendButton();

        updateCharCount();            handleQuickAction(action);    const toolsPanel = document.getElementById('toolsPanel');    const toolsPanel = document.getElementById('toolsPanel');

        

        showTypingIndicator();        }

        

        vscode.postMessage({            const attachPanel = document.getElementById('attachPanel');    const attachPanel = document.getElementById('attachPanel');

            type: 'agentQuery',

            prompt: message,        if (e.target.closest('.model-option')) {

            model: selectedModel,

            context: currentContext,            const model = e.target.closest('.model-option').dataset.model;    const closeTools = document.getElementById('closeTools');    const closeTools = document.getElementById('closeTools');

            history: conversationHistory.slice(-10)

        });            selectModel(model);

        

        conversationHistory.push({ role: 'user', content: message });        }    const closeAttach = document.getElementById('closeAttach');    const closeAttach = document.getElementById('closeAttach');

    }

        

    function updateSendButton() {

        const chatInput = document.getElementById('chatInput');        if (e.target.closest('.tool-item')) {

        const sendButton = document.getElementById('sendButton');

        if (chatInput && sendButton) {            const tool = e.target.closest('.tool-item').dataset.tool;

            const hasText = chatInput.value.trim().length > 0;

            sendButton.disabled = !hasText;            selectTool(tool);    // Event Listeners    // Event Listeners

        }

    }        }



    function updateCharCount() {            sendButton.addEventListener('click', handleSend);    sendBtn.addEventListener('click', handleSend);

        const chatInput = document.getElementById('chatInput');

        const charCount = document.getElementById('charCount');        if (e.target.closest('.attach-option')) {

        if (chatInput && charCount) {

            const count = chatInput.value.length;            const type = e.target.closest('.attach-option').dataset.type;    attachButton.addEventListener('click', toggleAttachPanel);    attachContext.addEventListener('click', handleAttachContext);

            charCount.textContent = `${count}/8000`;

        }            attachContext(type);

    }

        }    toolsButton.addEventListener('click', toggleToolsPanel);    useTools.addEventListener('click', toggleToolsPanel);

    function handleQuickAction(action) {

        const chatInput = document.getElementById('chatInput');        

        clearWelcome();

                // Close dropdowns when clicking outside    modelButton.addEventListener('click', toggleModelDropdown);    closeTools.addEventListener('click', () => toolsPanel.style.display = 'none');

        const actions = {

            'explain': 'Explain the current code selection',        if (!e.target.closest('.model-selector')) {

            'create-task': 'Create a new Cappy task',

            'analyze': 'Analyze the project structure',            hideModelDropdown();    closeTools.addEventListener('click', () => hidePanel('tools'));    

            'search': 'Search the codebase'

        };        }

        

        if (actions[action] && chatInput) {        if (!e.target.closest('.tools-panel') && !e.target.closest('#toolsButton')) {    closeAttach.addEventListener('click', () => hidePanel('attach'));    modelSelect.addEventListener('change', (e) => {

            chatInput.value = actions[action];

            chatInput.focus();            hidePanel('tools');

            updateCharCount();

            updateSendButton();        }            selectedModel = e.target.value;

        }

    }        if (!e.target.closest('.attach-panel') && !e.target.closest('#attachButton')) {



    function toggleModelDropdown() {            hidePanel('attach');    // Input handling        updateModelStatus();

        const modelDropdown = document.getElementById('modelDropdown');

        if (modelDropdown) {        }

            const isVisible = modelDropdown.style.display === 'block';

            modelDropdown.style.display = isVisible ? 'none' : 'block';    });    chatInput.addEventListener('input', handleInputChange);    });

        }

    }



    function toggleAttachPanel() {    // Handle messages from extension    chatInput.addEventListener('keydown', handleKeyDown);    

        const attachPanel = document.getElementById('attachPanel');

        if (attachPanel) {    window.addEventListener('message', event => {

            const isVisible = attachPanel.style.display === 'block';

            attachPanel.style.display = isVisible ? 'none' : 'block';        const message = event.data;        // Allow Enter to submit (Ctrl+Enter for new line)

        }

    }        



    function toggleToolsPanel() {        switch (message.type) {    // Quick actions    promptInput.addEventListener('keydown', (e) => {

        const toolsPanel = document.getElementById('toolsPanel');

        if (toolsPanel) {            case 'agentResponse':

            const isVisible = toolsPanel.style.display === 'block';

            toolsPanel.style.display = isVisible ? 'none' : 'block';                handleAgentResponse(message.data);    document.addEventListener('click', (e) => {        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {

        }

    }                break;



    function clearWelcome() {            case 'contextUpdate':        if (e.target.closest('.quick-action')) {            e.preventDefault();

        const welcomeContainer = document.querySelector('.welcome-container');

        if (welcomeContainer) {                handleContextUpdate(message.context);

            welcomeContainer.remove();

        }                break;            const action = e.target.closest('.quick-action').dataset.action;            handleSend();

    }

            case 'error':

    function addMessage(content, role) {

        const chatMessages = document.getElementById('chatMessages');                handleError(message.message);            handleQuickAction(action);        }

        if (!chatMessages) return;

                break;

        const messageDiv = document.createElement('div');

        messageDiv.className = `message ${role}`;        }        }    });

        

        const avatar = role === 'user' ? '👤' : '🦫';    });

        const author = role === 'user' ? 'You' : 'Cappy';

                

        messageDiv.innerHTML = `

            <div class="message-header">    function handleSend() {

                <div class="message-avatar">${avatar}</div>

                <div class="message-author">${author}</div>        const message = chatInput.value.trim();        if (e.target.closest('.model-option')) {    // Tool selection

            </div>

            <div class="message-content">${formatMessage(content)}</div>        if (!message) return;

        `;

                    const model = e.target.closest('.model-option').dataset.model;    document.addEventListener('click', (e) => {

        chatMessages.appendChild(messageDiv);

        scrollToBottom();        // Clear welcome if this is first message

    }

        clearWelcome();            selectModel(model);        if (e.target.closest('.tool-item')) {

    function showTypingIndicator() {

        const chatMessages = document.getElementById('chatMessages');

        if (!chatMessages) return;

        // Add user message        }            const toolItem = e.target.closest('.tool-item');

        const indicator = document.createElement('div');

        indicator.className = 'typing-indicator';        addMessage(message, 'user');

        indicator.innerHTML = `

            <div class="message-header">                            const toolName = toolItem.dataset.tool;

                <div class="message-avatar">🦫</div>

                <div class="message-author">Cappy</div>        // Clear input

            </div>

            <div class="typing-dots">        chatInput.value = '';        if (e.target.closest('.tool-item')) {            selectTool(toolName);

                <div class="typing-dot"></div>

                <div class="typing-dot"></div>        updateCharCount();

                <div class="typing-dot"></div>

            </div>        updateSendButton();            const tool = e.target.closest('.tool-item').dataset.tool;        }

        `;

                

        chatMessages.appendChild(indicator);

        scrollToBottom();        // Show typing indicator            selectTool(tool);    });

    }

        showTypingIndicator();

    function hideTypingIndicator() {

        const indicator = document.querySelector('.typing-indicator');                }

        if (indicator) {

            indicator.remove();        // Send to extension

        }

    }        vscode.postMessage({            // Handle messages from extension



    function formatMessage(content) {            type: 'agentQuery',

        return content

            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')            prompt: message,        if (e.target.closest('.attach-option')) {    window.addEventListener('message', event => {

            .replace(/\*(.*?)\*/g, '<em>$1</em>')

            .replace(/`(.*?)`/g, '<code style="background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px;">$1</code>')            model: selectedModel,

            .replace(/\n/g, '<br>');

    }            context: currentContext,            const type = e.target.closest('.attach-option').dataset.type;        const message = event.data;



    function scrollToBottom() {            history: conversationHistory.slice(-10)

        const chatMessages = document.getElementById('chatMessages');

        if (chatMessages) {        });            attachContext(type);        

            chatMessages.scrollTop = chatMessages.scrollHeight;

        }        

    }

        // Add to history        }        switch (message.type) {

    // Handle messages from extension

    window.addEventListener('message', function(event) {        conversationHistory.push({ role: 'user', content: message });

        const message = event.data;

            }                    case 'agentResponse':

        switch (message.type) {

            case 'agentResponse':

                hideTypingIndicator();

                addMessage(message.data.content, 'assistant');    function handleInputChange() {        // Close dropdowns when clicking outside                handleAgentResponse(message.data);

                conversationHistory.push({ role: 'assistant', content: message.data.content });

                break;        updateCharCount();

            case 'contextUpdate':

                currentContext = message.context;        updateSendButton();        if (!e.target.closest('.model-selector')) {                break;

                break;

            case 'error':        autoResize();

                hideTypingIndicator();

                addMessage(`❌ Error: ${message.message}`, 'assistant');    }            hideModelDropdown();            case 'contextUpdate':

                break;

        }

    });

    function handleKeyDown(e) {        }                handleContextUpdate(message.context);

    // Request initial context

    vscode.postMessage({ type: 'requestInitialData' });        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {

})();
            e.preventDefault();        if (!e.target.closest('.tools-panel') && !e.target.closest('#toolsButton')) {                break;

            handleSend();

        }            hidePanel('tools');            case 'toolsUpdate':

    }

        }                handleToolsUpdate(message.tools);

    function autoResize() {

        chatInput.style.height = 'auto';        if (!e.target.closest('.attach-panel') && !e.target.closest('#attachButton')) {                break;

        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';

    }            hidePanel('attach');            case 'modelsList':



    function updateCharCount() {        }                handleModelsUpdate(message.models);

        const count = chatInput.value.length;

        charCount.textContent = `${count}/8000`;    });                break;

        charCount.style.color = count > 7500 ? 'var(--vscode-errorForeground)' : 'var(--vscode-descriptionForeground)';

    }            case 'error':



    function updateSendButton() {    // Handle messages from extension                handleError(message.message);

        const hasText = chatInput.value.trim().length > 0;

        sendButton.disabled = !hasText;    window.addEventListener('message', event => {                break;

    }

        const message = event.data;        }

    function handleQuickAction(action) {

        clearWelcome();            });

        

        const actions = {        switch (message.type) {

            'explain': 'Explain the current code selection',

            'create-task': 'Create a new Cappy task',            case 'agentResponse':    function handleSend() {

            'analyze': 'Analyze the project structure',

            'search': 'Search the codebase'                handleAgentResponse(message.data);        const prompt = promptInput.value.trim();

        };

                        break;        if (!prompt) {

        if (actions[action]) {

            chatInput.value = actions[action];            case 'contextUpdate':            showError('Please enter a message first.');

            chatInput.focus();

            updateCharCount();                handleContextUpdate(message.context);            return;

            updateSendButton();

        }                break;        }

    }

            case 'error':

    function toggleModelDropdown() {

        isModelDropdownOpen = !isModelDropdownOpen;                handleError(message.message);        // Add user message to chat

        modelDropdown.style.display = isModelDropdownOpen ? 'block' : 'none';

        modelButton.classList.toggle('open', isModelDropdownOpen);                break;        addMessage(prompt, 'user');

    }

        }        

    function hideModelDropdown() {

        isModelDropdownOpen = false;    });        // Clear input

        modelDropdown.style.display = 'none';

        modelButton.classList.remove('open');        promptInput.value = '';

    }

    function handleSend() {        

    function selectModel(model) {

        selectedModel = model;        const message = chatInput.value.trim();        // Show loading state

        const option = document.querySelector(`[data-model="${model}"]`);

        if (option) {        if (!message) return;        setLoading(true);

            modelName.textContent = option.querySelector('.option-name').textContent;

                    addMessage('� Thinking...', 'assistant', true);

            // Update selected state

            document.querySelectorAll('.model-option').forEach(opt => opt.classList.remove('selected'));        // Clear welcome if this is first message        

            option.classList.add('selected');

        }        clearWelcome();        // Send request to extension with full context

        hideModelDropdown();

    }        vscode.postMessage({



    function toggleToolsPanel() {        // Add user message            type: 'agentQuery',

        const isVisible = toolsPanel.style.display === 'block';

        hidePanel('attach');        addMessage(message, 'user');            prompt: prompt,

        toolsPanel.style.display = isVisible ? 'none' : 'block';

    }                    model: selectedModel,



    function toggleAttachPanel() {        // Clear input            context: currentContext,

        const isVisible = attachPanel.style.display === 'block';

        hidePanel('tools');        chatInput.value = '';            tools: availableTools

        attachPanel.style.display = isVisible ? 'none' : 'block';

    }        updateCharCount();        });



    function hidePanel(type) {        updateSendButton();    }

        if (type === 'tools') {

            toolsPanel.style.display = 'none';        

        } else if (type === 'attach') {

            attachPanel.style.display = 'none';        // Show typing indicator    function handleAgentResponse(response) {

        }

    }        showTypingIndicator();        setLoading(false);



    function selectTool(tool) {                

        const toolPrefix = `@${tool} `;

        if (!chatInput.value.includes(toolPrefix)) {        // Send to extension        // Remove loading message

            chatInput.value = toolPrefix + chatInput.value;

            updateCharCount();        vscode.postMessage({        removeLoadingMessage();

            updateSendButton();

        }            type: 'agentQuery',        

        hidePanel('tools');

        chatInput.focus();            prompt: message,        // Add agent response

    }

            model: selectedModel,        addMessage(response.content, 'assistant');

    function attachContext(type) {

        vscode.postMessage({            context: currentContext,        

            type: 'attachContext',

            contextType: type            history: conversationHistory.slice(-10) // Last 10 messages for context        // Handle any tool results

        });

        hidePanel('attach');        });        if (response.toolResults) {

    }

                    response.toolResults.forEach(result => {

    function handleContextUpdate(context) {

        currentContext = context;        // Add to history                addToolResult(result);

        renderAttachments();

        updateContextInfo();        conversationHistory.push({ role: 'user', content: message });            });

    }

    }        }

    function renderAttachments() {

        chatAttachments.innerHTML = '';        

        

        currentContext.forEach((item, index) => {    function handleInputChange() {        // Update context if changed

            const pill = document.createElement('div');

            pill.className = 'attachment-pill';        updateCharCount();        if (response.newContext) {

            pill.innerHTML = `

                <span>${getContextIcon(item.type)} ${item.name}</span>        updateSendButton();            updateContext(response.newContext);

                <span class="attachment-remove" data-index="${index}">×</span>

            `;        autoResize();        }

            

            pill.querySelector('.attachment-remove').addEventListener('click', (e) => {    }    }

                e.stopPropagation();

                removeAttachment(index);

            });

                function handleKeyDown(e) {    function handleAttachContext() {

            chatAttachments.appendChild(pill);

        });        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {        // Request available context from extension

    }

            e.preventDefault();        vscode.postMessage({

    function getContextIcon(type) {

        const icons = {            handleSend();            type: 'requestContext'

            file: '📄',

            selection: '✂️',        }        });

            task: '📝',

            project: '📁'    }    }

        };

        return icons[type] || '📎';

    }

    function autoResize() {    function handleContextUpdate(context) {

    function removeAttachment(index) {

        currentContext.splice(index, 1);        chatInput.style.height = 'auto';        currentContext = context;

        renderAttachments();

        updateContextInfo();        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';        renderContextPills();

    }

    }        updateContextIndicator();

    function updateContextInfo() {

        const count = currentContext.length;    }

        contextInfo.textContent = count > 0 ? `${count} item${count > 1 ? 's' : ''} attached` : '';

    }    function updateCharCount() {



    function clearWelcome() {        const count = chatInput.value.length;    function handleToolsUpdate(tools) {

        const welcomeContainer = document.querySelector('.welcome-container');

        if (welcomeContainer) {        charCount.textContent = `${count}/8000`;        availableTools = tools;

            welcomeContainer.remove();

        }        charCount.style.color = count > 7500 ? 'var(--vscode-errorForeground)' : 'var(--vscode-descriptionForeground)';        renderToolsPanel();

    }

    }    }

    function addMessage(content, role) {

        const messageDiv = document.createElement('div');

        messageDiv.className = `message ${role}`;

            function updateSendButton() {    function handleModelsUpdate(models) {

        const avatar = role === 'user' ? '👤' : '🦫';

        const author = role === 'user' ? 'You' : 'Cappy';        const hasText = chatInput.value.trim().length > 0;        updateModelDropdown(models);

        

        messageDiv.innerHTML = `        sendButton.disabled = !hasText;    }

            <div class="message-header">

                <div class="message-avatar">${avatar}</div>    }

                <div class="message-author">${author}</div>

            </div>    function toggleToolsPanel() {

            <div class="message-content">${formatMessage(content)}</div>

        `;    function handleQuickAction(action) {        const isVisible = toolsPanel.style.display !== 'none';

        

        chatMessages.appendChild(messageDiv);        clearWelcome();        toolsPanel.style.display = isVisible ? 'none' : 'block';

        scrollToBottom();

    }                



    function showTypingIndicator() {        const actions = {        if (!isVisible) {

        const indicator = document.createElement('div');

        indicator.className = 'typing-indicator';            'explain': 'Explain the current code selection',            // Request available tools

        indicator.innerHTML = `

            <div class="message-header">            'create-task': 'Create a new Cappy task',            vscode.postMessage({

                <div class="message-avatar">🦫</div>

                <div class="message-author">Cappy</div>            'analyze': 'Analyze the project structure',                type: 'requestTools'

            </div>

            <div class="typing-dots">            'search': 'Search the codebase'            });

                <div class="typing-dot"></div>

                <div class="typing-dot"></div>        };        }

                <div class="typing-dot"></div>

            </div>            }

        `;

                if (actions[action]) {

        chatMessages.appendChild(indicator);

        scrollToBottom();            chatInput.value = actions[action];    function selectTool(toolName) {

    }

            chatInput.focus();        // Add tool reference to input

    function hideTypingIndicator() {

        const indicator = document.querySelector('.typing-indicator');            updateCharCount();        const currentValue = promptInput.value;

        if (indicator) {

            indicator.remove();            updateSendButton();        const toolRef = `@${toolName} `;

        }

    }        }        



    function handleAgentResponse(response) {    }        if (!currentValue.includes(toolRef)) {

        hideTypingIndicator();

        addMessage(response.content, 'assistant');            promptInput.value = toolRef + currentValue;

        

        // Add to history    function toggleModelDropdown() {        }

        conversationHistory.push({ role: 'assistant', content: response.content });

                isModelDropdownOpen = !isModelDropdownOpen;        

        // Handle tool results if any

        if (response.toolResults && response.toolResults.length > 0) {        modelDropdown.style.display = isModelDropdownOpen ? 'block' : 'none';        toolsPanel.style.display = 'none';

            response.toolResults.forEach(result => {

                addToolResult(result);        modelButton.classList.toggle('open', isModelDropdownOpen);        promptInput.focus();

            });

        }    }    }

    }



    function addToolResult(result) {

        const resultDiv = document.createElement('div');    function hideModelDropdown() {    function renderContextPills() {

        resultDiv.className = 'message assistant';

        resultDiv.innerHTML = `        isModelDropdownOpen = false;        contextPills.innerHTML = '';

            <div class="message-header">

                <div class="message-avatar">🛠️</div>        modelDropdown.style.display = 'none';        

                <div class="message-author">${result.toolName}</div>

            </div>        modelButton.classList.remove('open');        currentContext.forEach((item, index) => {

            <div class="message-content">

                <pre style="background: var(--vscode-textCodeBlock-background); padding: 8px; border-radius: 4px; font-size: 12px; overflow-x: auto;">${JSON.stringify(result.data, null, 2)}</pre>    }            const pill = document.createElement('div');

            </div>

        `;            pill.className = 'context-pill';

        

        chatMessages.appendChild(resultDiv);    function selectModel(model) {            pill.innerHTML = `

        scrollToBottom();

    }        selectedModel = model;                <span>${getContextIcon(item.type)} ${item.name}</span>



    function handleError(message) {        const option = document.querySelector(`[data-model="${model}"]`);                <span class="remove-context" data-index="${index}">×</span>

        hideTypingIndicator();

        addMessage(`❌ Error: ${message}`, 'assistant');        if (option) {            `;

    }

            modelName.textContent = option.querySelector('.option-name').textContent;            

    function formatMessage(content) {

        // Basic markdown-like formatting                        pill.querySelector('.remove-context').addEventListener('click', (e) => {

        return content

            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')            // Update selected state                e.stopPropagation();

            .replace(/\*(.*?)\*/g, '<em>$1</em>')

            .replace(/`(.*?)`/g, '<code style="background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px;">$1</code>')            document.querySelectorAll('.model-option').forEach(opt => opt.classList.remove('selected'));                removeContext(index);

            .replace(/\n/g, '<br>');

    }            option.classList.add('selected');            });



    function scrollToBottom() {        }            

        chatMessages.scrollTop = chatMessages.scrollHeight;

    }        hideModelDropdown();            contextPills.appendChild(pill);



    // Initialize    }        });

    console.log('🦫 Cappy Chat initialized');

    if (chatInput) {    }

        chatInput.focus();

        updateSendButton();    function toggleToolsPanel() {

    }

            const isVisible = toolsPanel.style.display === 'block';    function getContextIcon(type) {

    // Request initial context

    vscode.postMessage({ type: 'requestInitialData' });        hidePanel('attach');        const icons = {

})();
        toolsPanel.style.display = isVisible ? 'none' : 'block';            file: '📄',

    }            task: '📝',

            project: '📁',

    function toggleAttachPanel() {            search: '🔍',

        const isVisible = attachPanel.style.display === 'block';            prevention: '🛡️'

        hidePanel('tools');        };

        attachPanel.style.display = isVisible ? 'none' : 'block';        return icons[type] || '📎';

    }    }



    function hidePanel(type) {    function removeContext(index) {

        if (type === 'tools') {        currentContext.splice(index, 1);

            toolsPanel.style.display = 'none';        renderContextPills();

        } else if (type === 'attach') {        updateContextIndicator();

            attachPanel.style.display = 'none';    }

        }

    }    function updateContext(newContext) {

        currentContext = [...currentContext, ...newContext];

    function selectTool(tool) {        renderContextPills();

        const toolPrefix = `@${tool} `;        updateContextIndicator();

        if (!chatInput.value.includes(toolPrefix)) {    }

            chatInput.value = toolPrefix + chatInput.value;

            updateCharCount();    function updateContextIndicator() {

            updateSendButton();        const count = currentContext.length;

        }        if (count > 0) {

        hidePanel('tools');            contextIndicator.textContent = `📄 ${count} Context Item${count > 1 ? 's' : ''}`;

        chatInput.focus();            contextIndicator.classList.add('active');

    }        } else {

            contextIndicator.textContent = '📄 No Context';

    function attachContext(type) {            contextIndicator.classList.remove('active');

        vscode.postMessage({        }

            type: 'attachContext',    }

            contextType: type

        });    function renderToolsPanel() {

        hidePanel('attach');        const toolsGrid = document.querySelector('.tools-grid');

    }        if (!toolsGrid) {

            return;

    function handleContextUpdate(context) {        }

        currentContext = context;        

        renderAttachments();        toolsGrid.innerHTML = '';

        updateContextInfo();        

    }        availableTools.forEach(tool => {

            const toolItem = document.createElement('div');

    function renderAttachments() {            toolItem.className = 'tool-item';

        chatAttachments.innerHTML = '';            toolItem.dataset.tool = tool.name;

                    toolItem.innerHTML = `

        currentContext.forEach((item, index) => {                <span class="tool-icon">${tool.icon}</span>

            const pill = document.createElement('div');                <span class="tool-name">${tool.displayName}</span>

            pill.className = 'attachment-pill';            `;

            pill.innerHTML = `            toolsGrid.appendChild(toolItem);

                <span>${getContextIcon(item.type)} ${item.name}</span>        });

                <span class="attachment-remove" data-index="${index}">×</span>    }

            `;

                function updateModelDropdown(models) {

            pill.querySelector('.attachment-remove').addEventListener('click', (e) => {        modelSelect.innerHTML = '';

                e.stopPropagation();        

                removeAttachment(index);        models.forEach(model => {

            });            const option = document.createElement('option');

                        option.value = model.id;

            chatAttachments.appendChild(pill);            option.textContent = model.name;

        });            option.selected = model.id === selectedModel;

    }            modelSelect.appendChild(option);

        });

    function getContextIcon(type) {    }

        const icons = {

            file: '📄',    function updateModelStatus() {

            selection: '✂️',        // Could add model-specific status indicators here

            task: '📝',        console.log(`Model changed to: ${selectedModel}`);

            project: '📁'    }

        };

        return icons[type] || '📎';    function addMessage(content, type, isLoading = false) {

    }        const messageDiv = document.createElement('div');

        messageDiv.className = `message ${type}`;

    function removeAttachment(index) {        if (isLoading) {

        currentContext.splice(index, 1);            messageDiv.classList.add('loading-message');

        renderAttachments();        }

        updateContextInfo();        

    }        messageDiv.innerHTML = `

            <div class="message-content">${escapeHtml(content)}</div>

    function updateContextInfo() {        `;

        const count = currentContext.length;        

        contextInfo.textContent = count > 0 ? `${count} item${count > 1 ? 's' : ''} attached` : '';        chatArea.appendChild(messageDiv);

    }        chatArea.scrollTop = chatArea.scrollHeight;

    }

    function clearWelcome() {

        const welcomeContainer = document.querySelector('.welcome-container');    function addToolResult(result) {

        if (welcomeContainer) {        const resultDiv = document.createElement('div');

            welcomeContainer.remove();        resultDiv.className = 'message assistant';

        }        resultDiv.innerHTML = `

    }            <div class="message-content">

                <strong>🛠️ Tool: ${result.toolName}</strong><br>

    function addMessage(content, role) {                <pre>${escapeHtml(JSON.stringify(result.data, null, 2))}</pre>

        const messageDiv = document.createElement('div');            </div>

        messageDiv.className = `message ${role}`;        `;

                

        const avatar = role === 'user' ? '👤' : '🦫';        chatArea.appendChild(resultDiv);

        const author = role === 'user' ? 'You' : 'Cappy';        chatArea.scrollTop = chatArea.scrollHeight;

            }

        messageDiv.innerHTML = `

            <div class="message-header">    function removeLoadingMessage() {

                <div class="message-avatar">${avatar}</div>        const loadingMessages = chatArea.querySelectorAll('.loading-message');

                <div class="message-author">${author}</div>        loadingMessages.forEach(msg => msg.remove());

            </div>    }

            <div class="message-content">${formatMessage(content)}</div>

        `;    function setLoading(loading) {

                sendBtn.disabled = loading;

        chatMessages.appendChild(messageDiv);        if (loading) {

        scrollToBottom();            sendBtn.innerHTML = '<span class="btn-icon">⏳</span>Thinking...';

    }        } else {

            sendBtn.innerHTML = '<span class="btn-icon">🚀</span>Send';

    function showTypingIndicator() {        }

        const indicator = document.createElement('div');    }

        indicator.className = 'typing-indicator';

        indicator.innerHTML = `    function handleError(message) {

            <div class="message-header">        setLoading(false);

                <div class="message-avatar">🦫</div>        removeLoadingMessage();

                <div class="message-author">Cappy</div>        showError(message);

            </div>    }

            <div class="typing-dots">

                <div class="typing-dot"></div>    function showError(message) {

                <div class="typing-dot"></div>        addMessage(`❌ ${message}`, 'assistant');

                <div class="typing-dot"></div>    }

            </div>

        `;    function escapeHtml(text) {

                const div = document.createElement('div');

        chatMessages.appendChild(indicator);        div.textContent = text;

        scrollToBottom();        return div.innerHTML;

    }    }



    function hideTypingIndicator() {    // Initialize

        const indicator = document.querySelector('.typing-indicator');    console.log('🦫 Cappy Chat initialized');

        if (indicator) {    chatInput.focus();

            indicator.remove();    updateSendButton();

        }    

    }    // Request initial context

    vscode.postMessage({ type: 'requestInitialData' });

    function handleAgentResponse(response) {})();
        hideTypingIndicator();
        addMessage(response.content, 'assistant');
        
        // Add to history
        conversationHistory.push({ role: 'assistant', content: response.content });
        
        // Handle tool results if any
        if (response.toolResults && response.toolResults.length > 0) {
            response.toolResults.forEach(result => {
                addToolResult(result);
            });
        }
    }

    function addToolResult(result) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'message assistant';
        resultDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">🛠️</div>
                <div class="message-author">${result.toolName}</div>
            </div>
            <div class="message-content">
                <pre style="background: var(--vscode-textCodeBlock-background); padding: 8px; border-radius: 4px; font-size: 12px; overflow-x: auto;">${JSON.stringify(result.data, null, 2)}</pre>
            </div>
        `;
        
        chatMessages.appendChild(resultDiv);
        scrollToBottom();
    }

    function handleError(message) {
        hideTypingIndicator();
        addMessage(`❌ Error: ${message}`, 'assistant');
    }

    function formatMessage(content) {
        // Basic markdown-like formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px;">$1</code>')
            .replace(/\n/g, '<br>');
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Initialize
    console.log('🦫 Cappy Chat initialized');
    chatInput.focus();
    updateSendButton();
    
    // Request initial context
    vscode.postMessage({ type: 'requestInitialData' });
})();