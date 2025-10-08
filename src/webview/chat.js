// Chat Assistant JavaScript
(function() {
    const vscode = acquireVsCodeApi();
    
    let currentTodoData = null;
    let isEditing = false;

    // DOM Elements
    const promptInput = document.getElementById('promptInput');
    const generateBtn = document.getElementById('generateBtn');
    const chatArea = document.getElementById('chatArea');
    const todoSection = document.getElementById('todoSection');
    const todoList = document.getElementById('todoList');
    const createTaskBtn = document.getElementById('createTaskBtn');
    const regenerateBtn = document.getElementById('regenerateBtn');
    const editBtn = document.getElementById('editBtn');

    // Event Listeners
    generateBtn.addEventListener('click', handleGenerate);
    createTaskBtn.addEventListener('click', handleCreateTask);
    regenerateBtn.addEventListener('click', handleRegenerate);
    editBtn.addEventListener('click', handleEdit);
    
    // Allow Enter to submit (Ctrl+Enter for new line)
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
        }
    });

    // Handle messages from extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'todoGenerated':
                handleTodoGenerated(message.data);
                break;
            case 'taskCreated':
                handleTaskCreated(message.success);
                break;
            case 'error':
                handleError(message.message);
                break;
        }
    });

    function handleGenerate() {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            showError('Please describe your task first.');
            return;
        }

        // Add user message to chat
        addMessage(prompt, 'user');
        
        // Clear input
        promptInput.value = '';
        
        // Show loading state
        setLoading(true);
        addMessage('🤔 Analyzing your task and generating todo list...', 'assistant');
        
        // Send request to extension
        vscode.postMessage({
            type: 'generateTodoList',
            prompt: prompt
        });
    }

    function handleTodoGenerated(todoItems) {
        setLoading(false);
        
        // Remove loading message
        const messages = chatArea.querySelectorAll('.message');
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.classList.contains('assistant')) {
            lastMessage.remove();
        }
        
        // Add success message
        addMessage('✅ Great! I\'ve created a todo list for your task. Review it below and click "Create Cappy Task" when ready.', 'assistant');
        
        // Store todo data
        currentTodoData = { items: todoItems };
        
        // Render todo list
        renderTodoList(todoItems);
        
        // Show todo section
        todoSection.style.display = 'block';
        
        // Scroll to bottom
        todoSection.scrollIntoView({ behavior: 'smooth' });
    }

    function renderTodoList(todoItems) {
        todoList.innerHTML = '';
        
        todoItems.forEach((item, index) => {
            const todoItem = document.createElement('div');
            todoItem.className = `todo-item ${item.completed ? 'completed' : ''}`;
            todoItem.innerHTML = `
                <input type="checkbox" 
                       class="todo-checkbox" 
                       ${item.completed ? 'checked' : ''} 
                       data-index="${index}"
                       ${!isEditing ? 'disabled' : ''}>
                <div class="todo-content">
                    <div class="todo-title" contenteditable="${isEditing}">${escapeHtml(item.title)}</div>
                    <div class="todo-description" contenteditable="${isEditing}">${escapeHtml(item.description)}</div>
                </div>
            `;
            
            todoList.appendChild(todoItem);
            
            // Add event listeners for editing
            if (isEditing) {
                const checkbox = todoItem.querySelector('.todo-checkbox');
                checkbox.addEventListener('change', () => {
                    currentTodoData.items[index].completed = checkbox.checked;
                    todoItem.classList.toggle('completed', checkbox.checked);
                });
                
                const title = todoItem.querySelector('.todo-title');
                const description = todoItem.querySelector('.todo-description');
                
                title.addEventListener('blur', () => {
                    currentTodoData.items[index].title = title.textContent;
                });
                
                description.addEventListener('blur', () => {
                    currentTodoData.items[index].description = description.textContent;
                });
            }
        });
    }

    function handleCreateTask() {
        if (!currentTodoData) {
            showError('No todo list to create task from.');
            return;
        }
        
        setLoading(true);
        createTaskBtn.disabled = true;
        createTaskBtn.textContent = '⏳ Creating Task...';
        
        vscode.postMessage({
            type: 'createTask',
            todoData: currentTodoData
        });
    }

    function handleTaskCreated(success) {
        setLoading(false);
        createTaskBtn.disabled = false;
        createTaskBtn.innerHTML = '<span class="btn-icon">✅</span>Create Cappy Task';
        
        if (success) {
            addMessage('🎉 Perfect! Your Cappy task has been created successfully. You can now work on it using the existing Cappy commands.', 'assistant');
            
            // Hide todo section and reset
            setTimeout(() => {
                todoSection.style.display = 'none';
                currentTodoData = null;
                isEditing = false;
                updateEditButton();
            }, 2000);
        } else {
            showError('Failed to create task. Please try again.');
        }
    }

    function handleRegenerate() {
        const lastUserMessage = getLastUserMessage();
        if (lastUserMessage) {
            promptInput.value = lastUserMessage;
            handleGenerate();
        } else {
            showError('No previous prompt found to regenerate from.');
        }
    }

    function handleEdit() {
        isEditing = !isEditing;
        updateEditButton();
        renderTodoList(currentTodoData.items);
    }

    function updateEditButton() {
        editBtn.textContent = isEditing ? '💾 Save' : '✏️ Edit';
        editBtn.classList.toggle('primary-btn', isEditing);
        editBtn.classList.toggle('secondary-btn', !isEditing);
    }

    function handleError(message) {
        setLoading(false);
        showError(message);
    }

    function addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `
            <div class="message-content">${escapeHtml(content)}</div>
        `;
        
        chatArea.appendChild(messageDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function getLastUserMessage() {
        const userMessages = chatArea.querySelectorAll('.message.user .message-content');
        if (userMessages.length > 0) {
            return userMessages[userMessages.length - 1].textContent;
        }
        return null;
    }

    function setLoading(loading) {
        generateBtn.disabled = loading;
        if (loading) {
            generateBtn.innerHTML = '<span class="btn-icon">⏳</span>Generating...';
        } else {
            generateBtn.innerHTML = '<span class="btn-icon">🎯</span>Generate Todo List';
        }
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
    console.log('🦫 Cappy Chat Assistant initialized');
    promptInput.focus();
})();