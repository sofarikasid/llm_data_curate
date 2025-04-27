document.addEventListener('DOMContentLoaded', () => {
    // API endpoints
    const API_URL = '/api';
    
    // Add debug logging
    console.log("LLM Data Curation App initializing...");
    
    // State management
    const state = {
        currentFormat: 'chat', // 'chat' or 'instruction'
        dataset: [],
        validationResult: null,
        isValidating: false,
        // Pagination state
        currentPage: 1,
        entriesPerPage: 10
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

    // Template-related elements
    const chatTemplates = document.getElementById('chat-templates');
    const instructionTemplates = document.getElementById('instruction-templates');
    const entryModal = document.getElementById('entry-modal');
    const modalClose = document.querySelector('.modal-close');
    const modalBody = document.getElementById('modal-body');

    // Pagination elements
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const currentPageEl = document.getElementById('current-page');
    const totalPagesEl = document.getElementById('total-pages');
    const entriesPerPageSelect = document.getElementById('entries-per-page');

    // Initialize - load data from API
    initializeData();

    // Add validation UI
    const formContainer = document.querySelector('.editor-container');
    const validationPanel = document.createElement('div');
    validationPanel.className = 'validation-panel';
    validationPanel.innerHTML = `
        <div class="validation-header">
            <h3>Data Quality Check</h3>
            <span class="quality-score">Score: <span id="quality-score">N/A</span></span>
        </div>
        <div class="validation-content">
            <div id="validation-issues" class="validation-section issues"></div>
            <div id="validation-warnings" class="validation-section warnings"></div>
            <div id="validation-passes" class="validation-section passes"></div>
        </div>
        <button id="run-validation" class="secondary-btn">Check Quality</button>
    `;
    formContainer.appendChild(validationPanel);

    // Add event listener for validation button
    document.getElementById('run-validation').addEventListener('click', validateData);
    
    // Also validate before adding to dataset
    const originalAddToDataset = addToDataset;
    addToDataset = async function() {
        await validateData();
        if (state.validationResult && state.validationResult.issues.length > 0) {
            if (!confirm('There are quality issues with your data. Add anyway?')) {
                return;
            }
        }
        return originalAddToDataset.apply(this, arguments);
    };

    // Event Listeners
    formatBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const format = btn.id.split('-')[0]; // 'chat' or 'instruction'
            switchFormat(btn.id);
            updateTemplateVisibility(format);
        });
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

    // Add event listeners for templates
    document.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
            applyTemplate(card.dataset.template);
        });
    });

    // Modal close button
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            entryModal.style.display = 'none';
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === entryModal) {
            entryModal.style.display = 'none';
        }
    });

    // Add pagination event listeners
    prevPageBtn.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            updateDatasetPreview();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(state.dataset.length / state.entriesPerPage);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            updateDatasetPreview();
        }
    });
    
    entriesPerPageSelect.addEventListener('change', () => {
        state.entriesPerPage = parseInt(entriesPerPageSelect.value);
        state.currentPage = 1; // Reset to first page when changing entries per page
        updateDatasetPreview();
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

    function updateTemplateVisibility(format) {
        if (format === 'chat') {
            chatTemplates.classList.add('active');
            instructionTemplates.classList.remove('active');
        } else {
            chatTemplates.classList.remove('active');
            instructionTemplates.classList.add('active');
        }
    }

    function applyTemplate(templateName) {
        clearForm(); // Clear the current form first
        
        switch (templateName) {
            // Chat format templates
            case 'qa':
                // Set a system message
                document.querySelector('.message.system textarea').value = 
                    'You are a helpful assistant that provides accurate and concise answers to questions.';
                
                // Add user question
                addMessage('user');
                const userMsg = document.querySelectorAll('.message.user')[0];
                if (userMsg) {
                    userMsg.querySelector('textarea').value = 'What is machine learning?';
                }
                
                // Add assistant answer
                addMessage('assistant');
                const assistantMsg = document.querySelectorAll('.message.assistant')[0];
                if (assistantMsg) {
                    assistantMsg.querySelector('textarea').value = 
                        'Machine learning is a subset of artificial intelligence that enables computers to learn from data and improve their performance on specific tasks without being explicitly programmed. It involves algorithms that can analyze data, identify patterns, and make predictions or decisions.';
                }
                break;
                
            case 'conversation':
                // Set a system message
                document.querySelector('.message.system textarea').value = 
                    'You are a helpful assistant engaging in a natural conversation with the user.';
                
                // Add user message 1
                addMessage('user');
                const userMsg1 = document.querySelectorAll('.message.user')[0];
                if (userMsg1) {
                    userMsg1.querySelector('textarea').value = "I'm planning to visit New York next month. Any recommendations?";
                }
                
                // Add assistant message 1
                addMessage('assistant');
                const assistantMsg1 = document.querySelectorAll('.message.assistant')[0];
                if (assistantMsg1) {
                    assistantMsg1.querySelector('textarea').value = 
                        "That's exciting! New York has so much to offer. I'd recommend visiting iconic sites like Central Park, the Metropolitan Museum of Art, and the Empire State Building. For food, try some authentic New York pizza and bagels. How long will you be staying?";
                }
                
                // Add user message 2
                addMessage('user');
                const userMsg2 = document.querySelectorAll('.message.user')[1];
                if (userMsg2) {
                    userMsg2.querySelector('textarea').value = "I'll be there for a week. I'm particularly interested in museums and theater.";
                }
                
                // Add assistant message 2
                addMessage('assistant');
                const assistantMsg2 = document.querySelectorAll('.message.assistant')[1];
                if (assistantMsg2) {
                    assistantMsg2.querySelector('textarea').value = 
                        "A week is perfect! For museums, don't miss the MoMA, the Guggenheim, and the American Museum of Natural History. For theater, try to get tickets to a Broadway show - some popular ones are Hamilton, The Lion King, and Wicked. You might want to book those in advance. Will you be staying in Manhattan?";
                }
                break;
                
            // Instruction format templates
            case 'summarize':
                document.getElementById('instruction').value = 
                    'Summarize the following text in one paragraph.';
                    
                document.getElementById('input').value = 
                    'Artificial intelligence has made significant strides in recent years, transforming industries from healthcare to finance. Deep learning models, in particular, have shown remarkable capabilities in image recognition, natural language processing, and strategic games. However, these advancements come with concerns about ethics, privacy, and job displacement. Researchers are now focusing on developing AI systems that are not only powerful but also transparent, fair, and aligned with human values. The next decade is likely to see AI becoming more integrated into everyday life, with a greater emphasis on human-AI collaboration.';
                    
                document.getElementById('output').value = 
                    'Artificial intelligence has recently advanced significantly, revolutionizing industries like healthcare and finance through deep learning models that excel in image recognition, language processing, and strategic games. Despite these benefits, concerns exist about ethics, privacy, and job loss, leading researchers to develop AI systems that prioritize transparency, fairness, and human values. In the coming decade, we can expect AI to become more deeply integrated into daily life with an increasing focus on human-AI collaboration.';
                break;
                
            case 'classify':
                document.getElementById('instruction').value = 
                    'Classify the sentiment of the following text as positive, negative, or neutral.';
                    
                document.getElementById('input').value = 
                    'The new restaurant was beautifully decorated, but the service was painfully slow and the food was mediocre at best.';
                    
                document.getElementById('output').value = 'negative';
                break;
                
            case 'generate':
                document.getElementById('instruction').value = 
                    'Write a short poem about artificial intelligence.';
                    
                document.getElementById('input').value = '';
                    
                document.getElementById('output').value = 
                    'Silicon dreams in neural space,\nPatterns forming, interlace.\nMinded not by flesh but code,\nLearning as connections grow.\n\nHuman teachings set it free,\nTo see the world we cannot see.\nArtificial by design alone,\nIntelligence beyond our own.';
                break;
        }
        
        // Validate the template data
        validateData();
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

    async function validateData() {
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
        
        state.isValidating = true;
        updateValidationUI({quality_score: 0, issues: ['Validating...'], warnings: [], passes: false});
        
        const entry = {
            type: state.currentFormat,
            data: data
        };
        
        try {
            // Send to validation API
            const response = await fetch(`${API_URL}/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(entry)
            });
            
            if (!response.ok) {
                throw new Error('Failed to validate data');
            }
            
            const result = await response.json();
            console.log("Validation result:", result);
            
            state.validationResult = result;
            updateValidationUI(result);
            
        } catch (error) {
            console.error('Error validating data:', error);
            updateValidationUI({
                quality_score: 0, 
                issues: ['Error validating data: ' + error.message], 
                warnings: [], 
                passes: false
            });
        } finally {
            state.isValidating = false;
        }
    }

    function updateValidationUI(result) {
        const scoreElement = document.getElementById('quality-score');
        const issuesElement = document.getElementById('validation-issues');
        const warningsElement = document.getElementById('validation-warnings');
        const passesElement = document.getElementById('validation-passes');
        
        // Update score
        scoreElement.textContent = result.quality_score + '/100';
        
        // Set score color based on value
        if (result.quality_score >= 80) {
            scoreElement.className = 'score-good';
        } else if (result.quality_score >= 60) {
            scoreElement.className = 'score-medium';
        } else {
            scoreElement.className = 'score-poor';
        }
        
        // Update issues
        if (result.issues && result.issues.length > 0) {
            issuesElement.innerHTML = `
                <h4>Issues to Fix:</h4>
                <ul>${result.issues.map(issue => `<li>${issue}</li>`).join('')}</ul>
            `;
            issuesElement.style.display = 'block';
        } else {
            issuesElement.style.display = 'none';
        }
        
        // Update warnings
        if (result.warnings && result.warnings.length > 0) {
            warningsElement.innerHTML = `
                <h4>Suggestions:</h4>
                <ul>${result.warnings.map(warning => `<li>${warning}</li>`).join('')}</ul>
            `;
            warningsElement.style.display = 'block';
        } else {
            warningsElement.style.display = 'none';
        }
        
        // Update passes
        if (result.passes) {
            passesElement.innerHTML = '<div class="validation-success">✓ Your data passes quality checks</div>';
            passesElement.style.display = 'block';
        } else if (!result.issues || result.issues.length === 0) {
            passesElement.innerHTML = '<div class="validation-partial">⚠️ Your data passes but could be improved</div>';
            passesElement.style.display = 'block';
        } else {
            passesElement.style.display = 'none';
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

    function updateStatistics() {
        const totalEl = document.getElementById('total-entries');
        const chatEl = document.getElementById('chat-entries');
        const instructionEl = document.getElementById('instruction-entries');
        const qualityEl = document.getElementById('avg-quality');
        
        if (totalEl && chatEl && instructionEl && qualityEl) {
            const total = state.dataset.length;
            const chatEntries = state.dataset.filter(entry => entry.type === 'chat').length;
            const instructionEntries = state.dataset.filter(entry => entry.type === 'instruction').length;
            
            // Calculate average quality score if available
            let avgQuality = 0;
            let entriesWithScore = 0;
            
            state.dataset.forEach(entry => {
                if (entry.quality_score) {
                    avgQuality += entry.quality_score;
                    entriesWithScore++;
                }
            });
            
            avgQuality = entriesWithScore > 0 ? Math.round(avgQuality / entriesWithScore) : 0;
            
            totalEl.textContent = total;
            chatEl.textContent = chatEntries;
            instructionEl.textContent = instructionEntries;
            qualityEl.textContent = avgQuality;
        }
    }

    function updateDatasetPreview() {
        datasetCount.textContent = `(${state.dataset.length})`;
        
        // Update statistics
        updateStatistics();
        
        if (state.dataset.length === 0) {
            datasetPreview.innerHTML = `<p class="empty-message">No data entries yet. Add some entries to see them here.</p>`;
            updatePaginationControls(0, 0);
            return;
        }
        
        // Calculate pagination
        const totalEntries = state.dataset.length;
        const totalPages = Math.ceil(totalEntries / state.entriesPerPage);
        
        // Ensure currentPage is valid
        if (state.currentPage < 1) state.currentPage = 1;
        if (state.currentPage > totalPages) state.currentPage = totalPages;
        
        // Calculate start and end indices for current page
        const startIndex = (state.currentPage - 1) * state.entriesPerPage;
        const endIndex = Math.min(startIndex + state.entriesPerPage, totalEntries);
        
        // Get entries for current page
        const pageEntries = state.dataset.slice(startIndex, endIndex);
        
        datasetPreview.innerHTML = '';
        
        pageEntries.forEach((entry) => {
            const truncatedData = JSON.stringify(entry.data).substring(0, 100) + (JSON.stringify(entry.data).length > 100 ? '...' : '');
            
            // Determine quality badge
            const qualityScore = entry.quality_score || 0;
            let qualityClass = 'quality-low';
            if (qualityScore >= 80) {
                qualityClass = 'quality-high';
            } else if (qualityScore >= 60) {
                qualityClass = 'quality-medium';
            }
            
            const entryCard = document.createElement('div');
            entryCard.className = 'entry-card';
            entryCard.innerHTML = `
                <div class="entry-header">
                    <span class="entry-title">
                        ${entry.type === 'chat' ? 'OpenAI Chat Format' : 'Instruction Format'}
                        <span class="quality-badge ${qualityClass}" title="Quality Score: ${qualityScore}"></span>
                    </span>
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
        
        // Update pagination controls
        updatePaginationControls(totalEntries, totalPages);
    }
    
    function updatePaginationControls(totalEntries, totalPages) {
        // Update page indicator
        currentPageEl.textContent = state.currentPage;
        totalPagesEl.textContent = totalPages;
        
        // Update button states
        prevPageBtn.disabled = state.currentPage <= 1;
        nextPageBtn.disabled = state.currentPage >= totalPages;
        
        // Show/hide pagination controls
        const paginationControls = document.querySelector('.pagination-controls');
        if (paginationControls) {
            paginationControls.style.display = totalEntries > 0 ? 'flex' : 'none';
        }
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
            // Format the JSON for display
            const formattedJson = JSON.stringify(entry.data, null, 2);
            
            // Set modal content
            modalBody.innerText = formattedJson;
            
            // Display the modal
            entryModal.style.display = 'block';
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
        
        // Set initial template visibility
        updateTemplateVisibility(state.currentFormat);
        
        // Initialize entries per page from select
        state.entriesPerPage = parseInt(entriesPerPageSelect.value);
    }
});
