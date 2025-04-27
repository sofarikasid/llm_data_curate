document.addEventListener('DOMContentLoaded', () => {
    // API endpoints
    const API_URL = '/api';
    
    // Add debug logging
    console.log("LLM Data Curation App initializing...");
    
    // State management
    const state = {
        currentFormat: 'chat', // 'chat' or 'instruction'
        dataset: []
    };

    // DOM Elements
    const formatBtns = document.querySelectorAll('.format-btn');
    const chatEditor = document.getElementById('chat-editor');
    const instructionEditor = document.getElementById('instruction-editor');
    const addUserMsgBtn = document.getElementById('add-user-msg');
    const addAssistantMsgBtn = document.getElementById('add-assistant-msg');
    const addToDatasetBtn = document.getElementById('add-to-dataset');
    const clearFormBtn = document.getElementById('clear-form');
    const downloadDatasetBtn = document.getElementById('download-dataset');
    const downloadFormatSelect = document.getElementById('download-format');
    const clearDatasetBtn = document.getElementById('clear-dataset');
    const datasetPreview = document.getElementById('dataset-preview');
    const datasetCount = document.getElementById('dataset-count');
    const messagesContainer = document.querySelector('.messages-container');

    // Initialize - load data from API
    initializeData();

    // Event Listeners
    formatBtns.forEach(btn => {
        btn.addEventListener('click', () => switchFormat(btn.id));
    });

    addUserMsgBtn.addEventListener('click', () => addMessage('user'));
    addAssistantMsgBtn.addEventListener('click', () => addMessage('assistant'));
    addToDatasetBtn.addEventListener('click', addToDataset);
    clearFormBtn.addEventListener('click', clearForm);
    downloadDatasetBtn.addEventListener('click', downloadDataset);
    clearDatasetBtn.addEventListener('click', clearDataset);

    // Delegate event listener for dynamic delete buttons
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            e.target.closest('.message').remove();
        }

        if (e.target.classList.contains('delete-entry')) {
            const entryId = e.target.dataset.id;
            deleteEntry(entryId);
        }

        if (e.target.classList.contains('view-entry')) {
            const entryId = e.target.dataset.id;
            viewEntry(entryId);
        }
    });

    // Functions
    function switchFormat(formatId) {
        // Update buttons
        formatBtns.forEach(btn => {
            btn.classList.toggle('active', btn.id === formatId);
        });

        // Update editors
        const format = formatId.split('-')[0]; // 'chat' or 'instruction'
        chatEditor.classList.toggle('active', format === 'chat');
        instructionEditor.classList.toggle('active', format === 'instruction');
        
        state.currentFormat = format;
    }

    function addMessage(role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="role">${role}</span>
                <button class="delete-btn">Delete</button>
            </div>
            <textarea placeholder="${role === 'user' ? 'User message...' : 'Assistant response...'}" aria-label="${role} message"></textarea>
        `;
        messagesContainer.appendChild(messageDiv);
    }

    function getChatData() {
        const messages = [];
        const messageElements = document.querySelectorAll('.message');
        
        messageElements.forEach(message => {
            const role = message.querySelector('.role').innerText;
            const content = message.querySelector('textarea').value.trim();
            
            if (content) {
                messages.push({ role, content });
            }
        });
        
        return messages.length > 0 ? { messages } : null;
    }

    function getInstructionData() {
        const instruction = document.getElementById('instruction').value.trim();
        const input = document.getElementById('input').value.trim();
        const output = document.getElementById('output').value.trim();
        
        if (instruction && output) {
            const data = { instruction, output };
            if (input) data.input = input;
            return data;
        }
        
        return null;
    }

    async function addToDataset() {
        let data;
        
        if (state.currentFormat === 'chat') {
            data = getChatData();
        } else {
            data = getInstructionData();
        }
        
        if (!data) {
            alert('Please fill in the required fields');
            return;
        }
        
        // Add format type and timestamp metadata
        const entry = {
            type: state.currentFormat,
            data: data
        };
        
        console.log("Adding entry to dataset:", entry);
        
        try {
            // Send to API
            const response = await fetch(`${API_URL}/entries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(entry)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error (${response.status}):`, errorText);
                throw new Error(`${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log("Entry added successfully:", result);
            
            // Clear form and reload data
            clearForm();
            loadEntries();
            
            // Show success message
            const successMessage = document.createElement('div');
            successMessage.className = 'success-message';
            successMessage.textContent = 'Entry added to dataset successfully';
            document.querySelector('.action-buttons').appendChild(successMessage);
            setTimeout(() => successMessage.remove(), 3000);
            
        } catch (error) {
            console.error('Error adding entry to dataset:', error);
            alert('Failed to add entry to dataset: ' + error.message);
        }
    }

    function clearForm() {
        if (state.currentFormat === 'chat') {
            // Keep only the system message and clear its content
            const messages = document.querySelectorAll('.message');
            messages.forEach((msg, index) => {
                if (index === 0 && msg.classList.contains('system')) {
                    msg.querySelector('textarea').value = '';
                } else if (index !== 0) {
                    msg.remove();
                }
            });
        } else {
            document.getElementById('instruction').value = '';
            document.getElementById('input').value = '';
            document.getElementById('output').value = '';
        }
    }

    async function loadEntries() {
        try {
            console.log("Loading entries from API...");
            const response = await fetch(`${API_URL}/entries`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error (${response.status}):`, errorText);
                throw new Error(`Failed to load entries: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Loaded ${data.length} entries`, data);
            
            state.dataset = data;
            updateDatasetPreview();
            
        } catch (error) {
            console.error('Error loading entries:', error);
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = `Error loading data: ${error.message}. Check that the API server is running.`;
            
            // Add error message to UI
            const mainElement = document.querySelector('main');
            if (mainElement) {
                mainElement.prepend(errorMessage);
                setTimeout(() => errorMessage.remove(), 10000); // Remove after 10 seconds
            }
        }
    }

    function updateDatasetPreview() {
        datasetCount.textContent = `(${state.dataset.length})`;
        
        if (state.dataset.length === 0) {
            datasetPreview.innerHTML = `<p class="empty-message">No data entries yet. Add some entries to see them here.</p>`;
            return;
        }
        
        datasetPreview.innerHTML = '';
        
        state.dataset.forEach((entry) => {
            const truncatedData = JSON.stringify(entry.data).substring(0, 100) + (JSON.stringify(entry.data).length > 100 ? '...' : '');
            
            const entryCard = document.createElement('div');
            entryCard.className = 'entry-card';
            entryCard.innerHTML = `
                <div class="entry-header">
                    <span class="entry-title">${entry.type === 'chat' ? 'OpenAI Chat Format' : 'Instruction Format'}</span>
                    <small>${new Date(entry.timestamp).toLocaleString()}</small>
                </div>
                <div class="entry-content">${truncatedData}</div>
                <div class="entry-actions">
                    <button class="view-entry" data-id="${entry.id}">View</button>
                    <button class="delete-entry" data-id="${entry.id}">Delete</button>
                </div>
            `;
            
            datasetPreview.appendChild(entryCard);
        });
    }

    async function deleteEntry(id) {
        if (confirm('Are you sure you want to delete this entry?')) {
            try {
                const response = await fetch(`${API_URL}/entries/${id}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error('Failed to delete entry');
                }
                
                // Reload entries
                loadEntries();
                
            } catch (error) {
                console.error('Error deleting entry:', error);
                alert('Failed to delete entry: ' + error.message);
            }
        }
    }

    function viewEntry(id) {
        const entry = state.dataset.find(e => e.id === id);
        if (entry) {
            alert(JSON.stringify(entry.data, null, 2));
        }
    }

    async function downloadDataset() {
        try {
            const format = downloadFormatSelect.value;
            console.log(`Starting download in ${format} format`);
            
            if (format === 'json') {
                await downloadJSON();
            } else if (format === 'jsonl') {
                await downloadJSONL();
            }
        } catch (error) {
            console.error('Error downloading dataset:', error);
            alert('Failed to download dataset: ' + error.message);
        }
    }

    async function downloadJSON() {
        try {
            console.log("Fetching JSON data from API...");
            
            // Create an invisible iframe to handle the download
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            // Set the iframe source to the download endpoint
            iframe.src = `${API_URL}/download`;
            
            // Clean up after a delay
            setTimeout(() => {
                document.body.removeChild(iframe);
                console.log("Download iframe removed");
            }, 2000);
            
        } catch (error) {
            console.error('Error downloading JSON dataset:', error);
            throw error;
        }
    }

    async function downloadJSONL() {
        try {
            console.log("Fetching JSONL data from API...");
            
            // Create an invisible iframe to handle the download
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            // Set the iframe source to the download endpoint
            iframe.src = `${API_URL}/download/jsonl`;
            
            // Clean up after a delay
            setTimeout(() => {
                document.body.removeChild(iframe);
                console.log("Download iframe removed");
            }, 2000);
            
        } catch (error) {
            console.error('Error downloading JSONL dataset:', error);
            throw error;
        }
    }

    async function clearDataset() {
        if (confirm('Are you sure you want to clear the entire dataset? This action cannot be undone.')) {
            try {
                console.log("Clearing dataset...");
                const response = await fetch(`${API_URL}/entries`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API Error (${response.status}):`, errorText);
                    throw new Error(`Failed to clear dataset: ${response.status} ${response.statusText}`);
                }
                
                console.log("Dataset cleared successfully");
                
                // Show success message
                const successMessage = document.createElement('div');
                successMessage.className = 'success-message';
                successMessage.textContent = 'Dataset cleared successfully';
                document.querySelector('.dataset-controls').appendChild(successMessage);
                setTimeout(() => successMessage.remove(), 3000);
                
                // Reload entries
                loadEntries();
                
            } catch (error) {
                console.error('Error clearing dataset:', error);
                alert('Failed to clear dataset: ' + error.message);
            }
        }
    }

    async function initializeData() {
        // Load entries from API
        await loadEntries();
    }
});
