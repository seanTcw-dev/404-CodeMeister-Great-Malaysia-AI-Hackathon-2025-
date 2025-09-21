/**
 * AI Clinical Co-pilot Dashboard JavaScript
 * Professional healthcare interface for clinical document analysis
 */

// ===== API CONFIGURATION =====
// Configuration based on your .env file and API Gateway - UPDATED WITH NEW BUCKET
const API_CONFIG = {
    // Your API Gateway URLs - UPDATED WITH CORRECT ENDPOINTS
    QUERY_SERVICE_URL: 'https://tt9zsr0i5i.execute-api.us-east-1.amazonaws.com/v1/query', // Your query service API
    INGESTION_SERVICE_URL: 'https://tt9zsr0i5i.execute-api.us-east-1.amazonaws.com/v1/query', // Using same URL for now
    
    // UPDATED TO USE NEW BUCKET - From old frontend configuration
    S3_BUCKET: 'medical-docs-hackatown-2025',
    OPENSEARCH_HOST: 'search-medical-docs-simple-ctl4h3ochow6trthjca2mlyl2i.us-east-1.es.amazonaws.com',
    OPENSEARCH_INDEX: 'medical-docs',
    AWS_REGION: 'us-east-1'
};

// ===== HARDCODED AWS CONFIGURATION =====
// Direct hardcoded AWS credentials - EMBEDDED IN JS - UPDATED FROM OLD FRONTEND
window.AWS_CONFIG = {
    region: 'us-east-1',
    s3Bucket: 'medical-docs-hackatown-2025',
    accessKeyId: 'AKIAX2XQRBBZLF2ZEQKG',
    secretAccessKey: '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'
};

document.addEventListener('DOMContentLoaded', () => {
    // ===== DOM ELEMENTS =====
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatLog = document.getElementById('chat-log');
    const evidenceExplorer = document.getElementById('evidence-explorer');
    const closeEvidenceBtn = document.getElementById('close-evidence-btn');
    const evidenceDocTitle = document.getElementById('evidence-doc-title');
    const pdfViewer = document.getElementById('pdf-viewer');
    const loadingOverlay = document.getElementById('loading-overlay');
    const currentPatientElement = document.getElementById('current-patient');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const newSessionBtn = document.getElementById('new-session-btn');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    // File upload related elements
    const browseFilesBtn = document.getElementById('browse-files-btn');
    const fileInput = document.getElementById('file-input');
    const selectedFilesPreview = document.getElementById('selected-files-preview');
    const filesList = document.getElementById('files-list');
    
    // State for selected files
    let selectedFiles = [];

    // ===== STATE MANAGEMENT =====
    let currentSession = null; // No active session initially
    let isProcessing = false;
    let activeSessions = []; // Track all active sessions
    let currentMode = 'general'; // 'general' | 'patient' | 'pdf'

    // ===== THEME MANAGEMENT =====
    
    /**
     * Initialize theme system
     */
    function initTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        const savedTheme = localStorage.getItem('theme') || 'light';
        
        // Apply saved theme
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // Handle theme toggle
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            console.log(`Theme switched to: ${newTheme}`);
        });
        
        console.log(`Theme initialized: ${savedTheme}`);
    }
    
    // Initialize theme system
    initTheme();
    
    // ===== MODE MANAGEMENT =====
    
    /**
     * Initialize mode toggle system
     */
    function initModeToggle() {
        const modeRadios = document.querySelectorAll('input[name="chat-mode"]');
        const currentPatientElement = document.getElementById('current-patient');
        
        // Handle mode changes
        modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const newMode = e.target.value;
                setMode(newMode);
            });
        });
        
        // Set initial mode
        setMode('general');
    }
    
    /**
     * Set the current mode and update UI accordingly
     * @param {string} mode - 'general' | 'patient' | 'pdf'
     */
    function setMode(mode) {
        currentMode = mode;
        const currentPatientElement = document.getElementById('current-patient');
        
        console.log(`Mode changed to: ${mode}`);
        
        if (mode === 'general') {
            // General mode - hide patient info, clear current session
            currentPatientElement.style.display = 'none';
            currentSession = null;
            
            // Update welcome message for general mode
            updateWelcomeMessageForMode('general');
            // Hide file browse in General mode
            if (browseFilesBtn) browseFilesBtn.style.display = 'none';
            if (selectedFilesPreview) selectedFilesPreview.style.display = 'none';
            userInput.placeholder = 'Ask general medical questions...';
            // Clear any staged files when entering general mode
            selectedFiles = [];
            if (filesList) filesList.innerHTML = '';
            
        } else if (mode === 'patient') {
            // Patient mode - show patient info, require session
            currentPatientElement.style.display = 'block';
            
            // If no current session, show prompt to create one
            if (!currentSession) {
                updateWelcomeMessageForMode('patient');
            }
            // Show file browse in Patient mode
            if (browseFilesBtn) browseFilesBtn.style.display = 'inline-flex';
            userInput.placeholder = "Ask about this patient's records, medication interactions, lab trends, or safety concerns...";
        } else if (mode === 'pdf') {
            // PDF mode - hide patient info
            currentPatientElement.style.display = 'none';
            currentSession = null;
            // Update welcome message for pdf mode
            updateWelcomeMessageForMode('pdf');
            // Show file browse in PDF mode
            if (browseFilesBtn) browseFilesBtn.style.display = 'inline-flex';
            userInput.placeholder = 'Upload a PDF to extract and summarize...';
        }
        
        // Clear current chat and sessions when switching modes
        clearCurrentChat();
        
        // Filter sessions to show only current mode
        filterSessionsByMode(mode);
    }
    
    /**
     * Update welcome message based on current mode
     * @param {string} mode - 'general' | 'patient' | 'pdf'
     */
    function updateWelcomeMessageForMode(mode) {
        const welcomeMessage = document.getElementById('welcome-message');
        if (!welcomeMessage) return;
        
        if (mode === 'general') {
            welcomeMessage.innerHTML = `
                <div class="welcome-header">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M24 4L40 12V36L24 44L8 36V12L24 4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M24 24L40 12L24 4L8 12L24 24Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M8 36L24 24L40 36" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M24 44V24" stroke="currentColor" stroke-width="3"/>
                    </svg>
                    <h2>General Medical Assistant</h2>
                </div>
                <p class="welcome-description">
                    Ask general medical questions, get information about treatments, 
                    medications, or medical conditions. I can help with clinical knowledge 
                    and general healthcare guidance.
                </p>
                <div class="welcome-actions">
                    <button class="welcome-action-btn">What are the symptoms of hypertension?</button>
                    <button class="welcome-action-btn">Explain diabetes management</button>
                    <button class="welcome-action-btn">What is the treatment for pneumonia?</button>
                </div>
            `;
        } else if (mode === 'patient') {
            welcomeMessage.innerHTML = `
                <div class="welcome-header">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M24 4L40 12V36L24 44L8 36V12L24 4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M24 24L40 12L24 4L8 12L24 24Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M8 36L24 24L40 36" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M24 44V24" stroke="currentColor" stroke-width="3"/>
                    </svg>
                    <h2>Patient-Specific Analysis</h2>
                </div>
                <p class="welcome-description">
                    Create a new patient session to analyze specific medical documents, 
                    track patient history, and get personalized clinical insights. 
                    Upload patient documents and ask questions about their specific case.
                </p>
                <div class="welcome-actions">
                    <button class="welcome-action-btn">Create New Patient Session</button>
                    <button class="welcome-action-btn">Upload Patient Documents</button>
                </div>
            `;
        } else if (mode === 'pdf') {
            welcomeMessage.innerHTML = `
                <div class="welcome-header">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M24 4L40 12V36L24 44L8 36V12L24 4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M24 24L40 12L24 4L8 12L24 24Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M8 36L24 24L40 36" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M24 44V24" stroke="currentColor" stroke-width="3"/>
                    </svg>
                    <h2>PDF Document Mode</h2>
                </div>
                <p class="welcome-description">
                    Upload a PDF to extract readable text. I will summarize the content and you can ask follow-up questions about it.
                </p>
                <div class="welcome-actions">
                    <button class="welcome-action-btn">Upload a medical PDF</button>
                    <button class="welcome-action-btn">How do you process PDFs?</button>
                </div>
            `;
        }
    }

    /**
     * OCR fallback: render each PDF page to canvas and run Tesseract.js
     * @param {File} file
     * @returns {Promise<string>} OCR extracted text
     */
    async function ocrExtractTextFromPdf(file) {
        if (!window.pdfjsLib) throw new Error('PDF.js library not loaded');
        if (!window.Tesseract) throw new Error('Tesseract.js not loaded');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        // Create an offscreen canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            // Render page to canvas
            await page.render({ canvasContext: ctx, viewport }).promise;
            const dataUrl = canvas.toDataURL('image/png');
            // OCR with Tesseract
            const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng', {
                tessedit_pageseg_mode: 1
            });
            fullText += (text || '') + '\n\n';
            // Clear canvas for next page
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return fullText.replace(/\s+/g, ' ').replace(/\n\s*/g, '\n').trim();
    }
    
    /**
     * Create a lightweight structured summary of extracted PDF text on the client.
     * Heuristic only (no AI call). Produces consistent clinical-style sections.
     * @param {string} text
     * @param {string} filename
     * @returns {string}
     */
    function summarizeExtractedText(text, filename = '') {
        try {
            const clean = String(text || '').replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
            const lower = clean.toLowerCase();
            
            // Attempt to find headings and split into chunks
            const sections = {};
            const headingRegex = /(diagnoses?|problems?|assessment|medications?|drugs?|rx|labs?|imaging|procedures?|history|plan|summary|overview|impression|findings|conclusion)s?:?/ig;
            let lastIndex = 0;
            let match;
            const found = [];
            while ((match = headingRegex.exec(clean)) !== null) {
                found.push({ idx: match.index, title: match[0] });
            }
            if (found.length > 0) {
                for (let i = 0; i < found.length; i++) {
                    const start = found[i].idx;
                    const end = i + 1 < found.length ? found[i + 1].idx : clean.length;
                    const title = found[i].title.replace(/:$/,'').trim();
                    const body = clean.slice(start + found[i].title.length, end).trim();
                    sections[title.toLowerCase()] = body;
                }
            }
            
            // Simple extractors
            const lines = clean.split(/(?<=\.)\s+/).slice(0, 50); // first ~50 sentences
            const meds = Array.from(clean.matchAll(/\b([A-Z][a-zA-Z\-]{2,})(?:\s+\d+(?:mg|mcg|g|ml|units|IU))?\b/g))
                .map(m => m[0])
                .filter((v, i, a) => a.indexOf(v) === i)
                .slice(0, 12);
            const labs = Array.from(clean.matchAll(/\b(?:WBC|RBC|Hb|Hgb|Platelets|Creatinine|BUN|Na|K|AST|ALT|ALP|CRP|ESR|LDL|HDL|A1C|HbA1c)\b[^\n\.]{0,40}?\b\d+(?:\.\d+)?\b/gi))
                .map(m => m[0])
                .slice(0, 10);
            const dates = Array.from(clean.matchAll(/\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/gi))
                .map(m => m[0])
                .filter((v, i, a) => a.indexOf(v) === i)
                .slice(0, 8);
            
            // Overview: first 2-3 sentences
            const overview = lines.slice(0, 3).join(' ');
            // Problems/Diagnoses: try from captured sections; fallback heuristics
            const problems = sections['diagnosis'] || sections['diagnoses'] || sections['problems'] || sections['assessment'] || '';
            // Medications from section or regex
            const medsText = (sections['medications'] || sections['drugs'] || sections['rx'] || '') || (meds.length ? meds.join(', ') : 'Not specified');
            // Labs/Imaging/Procedures
            const lip = (sections['labs'] || sections['imaging'] || sections['procedures'] || sections['findings'] || sections['impression'] || '') || (labs.length ? ('Notable results: ' + labs.join('; ')) : 'Not specified');
            // Key timelines
            const timelines = dates.length ? ('Dates mentioned: ' + dates.join(', ')) : (sections['history'] || 'Not specified');
            
            // Key takeaways: pick some salient sentences (with keywords) or fallback
            const takeawayKeywords = /(diagnos|improv|worsen|increase|decrease|elevat|abnormal|start|stop|recommend|plan|follow\-?up)/i;
            const takeaways = lines.filter(s => takeawayKeywords.test(s)).slice(0, 5);
            while (takeaways.length < 3 && takeaways.length < lines.length) {
                takeaways.push(lines[takeaways.length] || '');
            }
            const takeawaysClean = takeaways.filter(Boolean).slice(0, 5);
            
            const title = filename ? `Document: ${filename}` : 'Document Summary';
            let out = `${title}\n\n`;
            out += `Overview:\n${overview || 'Not specified.'}\n\n`;
            out += `Diagnoses / Problems:\n${(problems || 'Not specified').slice(0, 800)}\n\n`;
            out += `Medications:\n${medsText.slice(0, 600)}\n\n`;
            out += `Labs / Imaging / Procedures:\n${lip.slice(0, 900)}\n\n`;
            out += `Key Timelines:\n${(timelines || 'Not specified').slice(0, 500)}\n\n`;
            if (takeawaysClean.length) {
                out += `Key Takeaways:\n- ${takeawaysClean.join('\n- ').slice(0, 1000)}\n`;
            }
            return out.trim();
        } catch (e) {
            console.error('summarizeExtractedText error:', e);
            // Fallback to truncated text
            return (text || '').slice(0, 8000);
        }
    }
    
    /**
     * Clear current chat messages (but keep welcome message)
     */
    function clearCurrentChat() {
        const chatLog = document.getElementById('chat-log');
        const welcomeMessage = document.getElementById('welcome-message');
        
        // Remove all messages except welcome message
        const messages = chatLog.querySelectorAll('.chat-message, .message, .ai-thinking-container');
        messages.forEach(message => {
            if (message !== welcomeMessage) {
                message.remove();
            }
        });
        
        // Show welcome message
        if (welcomeMessage) {
            welcomeMessage.style.display = 'block';
        }
    }
    
    /**
     * Filter sessions in sidebar to show only current mode
     * @param {string} mode - 'general' or 'patient'
     */
    function filterSessionsByMode(mode) {
        const sessionHistory = document.getElementById('session-history');
        const sessionItems = sessionHistory.querySelectorAll('.session-item');
        
        // Hide all sessions first
        sessionItems.forEach(item => {
            item.style.display = 'none';
        });
        
        // Show only sessions matching current mode
        sessionItems.forEach(item => {
            const itemMode = item.dataset.mode;
            if (itemMode === mode) {
                item.style.display = 'block';
            }
        });
        
        // Show empty state if no sessions for this mode
        const visibleSessions = sessionHistory.querySelectorAll('.session-item[style*="block"]');
        const noSessionsPlaceholder = document.getElementById('no-sessions-placeholder');
        
        if (visibleSessions.length === 0) {
            if (noSessionsPlaceholder) {
                noSessionsPlaceholder.style.display = 'block';
            } else {
                // Create empty state if it doesn't exist
                const emptyState = document.createElement('div');
                emptyState.id = 'no-sessions-placeholder';
                emptyState.className = 'no-sessions-placeholder';
                let label = 'sessions';
                if (mode === 'general') label = 'general chat sessions';
                else if (mode === 'patient') label = 'patient sessions';
                else if (mode === 'pdf') label = 'PDF sessions';
                emptyState.innerHTML = `
                    <p>No ${label}</p>
                `;
                sessionHistory.appendChild(emptyState);
            }
        } else {
            if (noSessionsPlaceholder) {
                noSessionsPlaceholder.style.display = 'none';
            }
        }
    }
    
    /**
     * Restore chat messages from a session
     * @param {Object} session - Session object with messages array
     */
    function restoreSessionMessages(session) {
        const chatLog = document.getElementById('chat-log');
        const welcomeMessage = document.getElementById('welcome-message');
        
        // Hide welcome message
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
        
        // Restore each message
        session.messages.forEach(messageData => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('chat-message', messageData.sender);
            messageElement.innerHTML = messageData.html;
            chatLog.appendChild(messageElement);
        });
        
        // Scroll to bottom to show latest messages
        setTimeout(() => {
            chatLog.scrollTop = chatLog.scrollHeight;
        }, 100);
        
        console.log(`Restored ${session.messages.length} messages for session ${session.id}`);
    }
    
    // Initialize mode toggle system
    initModeToggle();

    // ===== EVENT LISTENERS =====

/**
 * Clear current chat messages (but keep welcome message)
 */
function clearCurrentChat() {
    const chatLog = document.getElementById('chat-log');
    const welcomeMessage = document.getElementById('welcome-message');
            
    // Remove all messages except welcome message
    const messages = chatLog.querySelectorAll('.chat-message, .message, .ai-thinking-container');
    messages.forEach(message => {
        if (message !== welcomeMessage) {
            message.remove();
        }
    });
            
    // Show welcome message
    if (welcomeMessage) {
        welcomeMessage.style.display = 'block';
    }
}

/**
 * Filter sessions in sidebar to show only current mode
 * @param {string} mode - 'general' | 'patient' | 'pdf'
 */
function filterSessionsByMode(mode) {
    const sessionHistory = document.getElementById('session-history');
    const sessionItems = sessionHistory.querySelectorAll('.session-item');
            
    // Hide all sessions first
    sessionItems.forEach(item => {
        item.style.display = 'none';
    });
            
    // Show only sessions matching current mode
    sessionItems.forEach(item => {
        const itemMode = item.dataset.mode;
        if (itemMode === mode) {
            item.style.display = 'block';
        }
    });
            
    // Show empty state if no sessions for this mode
    const visibleSessions = sessionHistory.querySelectorAll('.session-item[style*="block"]');
    const noSessionsPlaceholder = document.getElementById('no-sessions-placeholder');
            
    if (visibleSessions.length === 0) {
        if (noSessionsPlaceholder) {
            noSessionsPlaceholder.style.display = 'block';
        } else {
            // Create empty state if it doesn't exist
            const emptyState = document.createElement('div');
            emptyState.id = 'no-sessions-placeholder';
            emptyState.className = 'no-sessions-placeholder';
            let label = 'sessions';
            if (mode === 'general') label = 'general chat sessions';
            else if (mode === 'patient') label = 'patient sessions';
            else if (mode === 'pdf') label = 'PDF sessions';
            emptyState.innerHTML = `<p>No ${label}</p>`;
            sessionHistory.appendChild(emptyState);
        }
    } else {
        if (noSessionsPlaceholder) {
            noSessionsPlaceholder.style.display = 'none';
        }
    }
}

/**
 * Restore chat messages from a session
 * @param {Object} session - Session object with messages array
 */
function restoreSessionMessages(session) {
    const chatLog = document.getElementById('chat-log');
    const welcomeMessage = document.getElementById('welcome-message');
            
    // Hide welcome message
    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }
            
    // Restore each message
    session.messages.forEach(messageData => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', messageData.sender);
        messageElement.innerHTML = messageData.html;
        chatLog.appendChild(messageElement);
    });
            
    // Scroll to bottom to show latest messages
    setTimeout(() => {
        chatLog.scrollTop = chatLog.scrollHeight;
    }, 100);
            
    console.log(`Restored ${session.messages.length} messages for session ${session.id}`);
}

// Initialize mode toggle system
initModeToggle();

// ===== EVENT LISTENERS =====

/**
 * Handle chat form submission - handles both text and file uploads
 */
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
            
    const userMessage = userInput.value.trim();
    const hasFiles = selectedFiles.length > 0;
            
    console.log('Form submitted:', { userMessage, hasFiles, isProcessing }); // Debug log
            
    if (!isProcessing) {
        if (hasFiles) {
            // Upload files
            await handleFileUpload(selectedFiles);
        } else if (userMessage) {
            // Send text message
            await handleUserMessage(userMessage);
            userInput.value = '';
            autoResizeTextarea();
        }
    }
});

    /**
     * Handle session item clicks
     */
    document.addEventListener('click', (e) => {
        const sessionItem = e.target.closest('.session-item');
        if (sessionItem) {
            switchSession(sessionItem);
        }
    });

    /**
     * Handle evidence explorer controls
     */
    closeEvidenceBtn.addEventListener('click', () => {
        hideEvidence();
    });

    /**
     * Handle clear chat button
     */
    clearChatBtn.addEventListener('click', () => {
        clearChatHistory();
    });

    /**
     * Handle new session button
     */
    newSessionBtn.addEventListener('click', () => {
        createNewSession();
    });

    /**
     * Handle use case expansion button
     */
    const useCaseExpansionBtn = document.getElementById('use-case-expansion-btn');
    useCaseExpansionBtn.addEventListener('click', () => {
        createUseCaseExpansionSessions();
    });

    /**
     * Auto-resize textarea as user types
     */
    userInput.addEventListener('input', () => {
        autoResizeTextarea();
    });

    /**
     * Handle keyboard shortcuts
     */
    document.addEventListener('keydown', (e) => {
        // Enter key in textarea to send message (without Ctrl/Cmd)
        if (e.target === userInput && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
        
        // Ctrl+Enter or Cmd+Enter to send message (alternative)
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
        
        // Escape to close evidence explorer
        if (e.key === 'Escape' && evidenceExplorer.classList.contains('active')) {
            hideEvidence();
        }
    });

    // ===== FILE UPLOAD EVENT LISTENERS =====
    
    /**
     * Browse files button - opens file dialog
     */
    browseFilesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
    });

    /**
     * Handle file selection from dialog
     */
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            if (currentMode === 'pdf') {
                // Process immediately in PDF mode
                await handleFileUpload(files);
            } else {
                handleFileSelection(files);
            }
        }
    });

    /**
     * Handle drag and drop on entire chat window
     */
    chatLog.addEventListener('dragover', (e) => {
        e.preventDefault();
        chatLog.classList.add('drag-highlight');
    });

    chatLog.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!chatLog.contains(e.relatedTarget)) {
            chatLog.classList.remove('drag-highlight');
        }
    });

    chatLog.addEventListener('drop', async (e) => {
        e.preventDefault();
        chatLog.classList.remove('drag-highlight');
        
        const files = Array.from(e.dataTransfer.files).filter(file => 
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        );
        
        if (files.length > 0) {
            if (currentMode === 'pdf') {
                await handleFileUpload(files);
            } else {
                handleFileSelection(files);
            }
        } else if (e.dataTransfer.files.length > 0) {
            alert('Please select only PDF files.');
        }
    });

     // ===== GLOBAL DRAG-AND-DROP OVERLAY =====
    
    const dropOverlay = document.getElementById('drop-overlay');
    
    /**
     * Show overlay when dragging files anywhere on the page
     */
    document.addEventListener('dragenter', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            dropOverlay.style.display = 'flex';
        }
    });
    
    /**
     * Keep overlay visible while dragging over it
     */
    dropOverlay.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropOverlay.classList.add('drag-over');
    });
    
    /**
     * Remove drag-over class when leaving overlay
     */
    dropOverlay.addEventListener('dragleave', (e) => {
        if (!dropOverlay.contains(e.relatedTarget)) {
            dropOverlay.classList.remove('drag-over');
        }
    });
    
    /**
     * Handle file drop on overlay
     */
    dropOverlay.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropOverlay.style.display = 'none';
        dropOverlay.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files).filter(file => 
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        );
        
        if (files.length > 0) {
            if (currentMode === 'pdf') {
                await handleFileUpload(files);
            } else {
                handleFileSelection(files);
            }
        } else if (e.dataTransfer.files.length > 0) {
            alert('Please select only PDF files.');
        }
    });
    
    /**
     * Hide overlay when pressing Escape key
     */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dropOverlay.style.display === 'flex') {
            dropOverlay.style.display = 'none';
            dropOverlay.classList.remove('drag-over');
        }
    });



    // ===== CORE FUNCTIONS =====

    /**
     * Handle user message submission and AI response
     * @param {string} message - The user's message
     */
    async function handleUserMessage(message) {
        try {
            isProcessing = true;
            
            // Hide welcome message when user sends first message
            hideWelcomeMessage();
            
            // Add user message to chat
            addMessageToLog(message, 'user');
            
            // Show thinking indicator immediately
            showThinkingIndicator();
            
            // Handle different modes
            let aiResponse;
            if (currentMode === 'general') {
                // General mode - auto-create session if none exists
                if (!currentSession) {
                    currentSession = createGeneralSession(message);
                    addSessionToSidebar(currentSession);
                    setCurrentSession(currentSession);
                }
                aiResponse = await sendGeneralMessage(message);
            } else if (currentMode === 'patient') {
                // Patient mode - require active session and send patient-specific questions
                if (!currentSession) {
                    aiResponse = {
                        text: 'Please create a new patient session first by clicking "New Session" in the sidebar, then upload patient documents.',
                        type: 'error'
                    };
                } else {
                    // 1) Local memory: capture "remember ..." commands
                    const rememberMatch = /^(?:please\s+)?remember\b\s*(?:that\s*)?(.*)$/i.exec(message);
                    if (rememberMatch && rememberMatch[1]) {
                        const fact = rememberMatch[1].trim();
                        currentSession.contextFacts = currentSession.contextFacts || [];
                        currentSession.contextFacts.push(fact);
                        aiResponse = {
                            text: `Noted. I will remember: ${fact}`,
                            type: 'normal'
                        };
                    } else {
                        // 2) Try to answer simple patient questions locally
                        const localAnswer = tryAnswerFromPatientContext(message, currentSession);
                        if (localAnswer) {
                            aiResponse = { text: localAnswer, type: 'normal' };
                        } else {
                            // 3) Fallback to backend
                            aiResponse = await sendPatientMessage(message);
                        }
                    }
                }
            } else if (currentMode === 'pdf') {
                // PDF mode - guide the user to upload a PDF
                if (!currentSession) {
                    currentSession = createPdfSession('Untitled PDF Session');
                    addSessionToSidebar(currentSession);
                    setCurrentSession(currentSession);
                }
                aiResponse = {
                    text: 'Please upload a PDF using the Browse Files button so I can extract the text and summarize it for you.',
                    type: 'normal',
                    mode: 'pdf'
                };
            }
            
            // Remove thinking indicator
            hideThinkingIndicator();
            
            // Display AI response with animations
            displayAiResponse(aiResponse);
            
        } catch (error) {
            console.error('Error handling user message:', error);
            hideThinkingIndicator();
            addMessageToLog('I apologize, but I encountered an error processing your request. Please try again.', 'ai', 'error');
        } finally {
            isProcessing = false;
        }
    }

    /**
     * Add a message to the chat log
     * @param {string} message - The message text
     * @param {string} sender - 'user', 'ai', or 'system'
     * @param {string} type - Optional message type for special formatting
     */
    function addMessageToLog(message, sender, type = 'normal') {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', sender);
        
        const timestamp = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        let messageHTML = '';
        
        if (sender === 'system') {
            messageHTML = `
                <div class="message-content">
                    <i class="fas fa-robot"></i>
                    <p>${message}</p>
                </div>
            `;
        } else {
            const icon = sender === 'user' ? 'fa-user' : 'fa-robot';
            messageHTML = `
                <div class="message-content">
                    <div class="message-header">
                        <i class="fas ${icon}"></i>
                        <span class="timestamp">Today, ${timestamp}</span>
                    </div>
                    ${formatMessageContent(message, type)}
                </div>
            `;
        }
        
        messageElement.innerHTML = messageHTML;
        chatLog.appendChild(messageElement);
        
        // Store message in current session if it exists
        if (currentSession) {
            const messageData = {
                id: `msg-${Date.now()}`,
                text: message,
                sender: sender,
                type: type,
                timestamp: timestamp,
                html: messageHTML
            };
            
            if (!currentSession.messages) {
                currentSession.messages = [];
            }
            currentSession.messages.push(messageData);
            currentSession.messageCount = (currentSession.messageCount || 0) + 1;
            
            console.log(`Stored message in session ${currentSession.id}:`, messageData);
        }
        
        // Enhanced scrolling to ensure full message visibility
        setTimeout(() => {
            chatLog.scrollTop = chatLog.scrollHeight;
        }, 50);
        
        // Additional scroll after DOM is fully updated
        requestAnimationFrame(() => {
            chatLog.scrollTop = chatLog.scrollHeight;
        });
    }

    /**
     * Format message content based on type
     * @param {string} message - The message text
     * @param {string} type - The message type
     * @returns {string} Formatted HTML
     */
    function formatMessageContent(message, type) {
        if (type === 'safety-alert') {
            return createSafetyAlert(message);
        }
        
        // Convert newlines to HTML and preserve formatting
        const formattedMessage = message
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return `<div class="message-text">${formattedMessage}</div>`;
    }

    /**
     * Create safety alert HTML with animation classes
     * @param {string} message - The alert message
     * @returns {string} Safety alert HTML
     */
    function createSafetyAlert(message) {
        return `
            <div class="safety-alert critical animate-highlight">
                <div class="alert-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="alert-content">
                    <h4>CRITICAL SAFETY ALERT</h4>
                    <p>${message}</p>
                    <div class="alert-actions">
                        <button class="btn-alert" onclick="reviewRecords()">Review Records</button>
                        <button class="btn-alert" onclick="flagForReview()">Flag for Review</button>
                    </div>
                </div>
                <button class="alert-close-btn" onclick="this.parentElement.style.display='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }

    /**
     * Create a new session according to the current mode
     */
    function createNewSession() {
        try {
            if (currentMode === 'general') {
                const sessionName = prompt('Name this general chat session:') || 'General Chat';
                const newSession = {
                    id: `general-${Date.now()}`,
                    sessionName: sessionName,
                    sessionType: 'General Medical Chat',
                    timestamp: new Date(),
                    mode: 'general',
                    messageCount: 0,
                    messages: []
                };
                activeSessions.push(newSession);
                addSessionToSidebar(newSession);
                setCurrentSession(newSession);
                clearChatHistory();
                updateWelcomeMessageForMode('general');
            } else if (currentMode === 'patient') {
                const patientName = prompt('Enter patient name:') || 'Unnamed Patient';
                const patientId = prompt('Enter patient ID (optional):') || `P-${Date.now()}`;
                const newSession = createPatientSession(patientName, patientId);
                addSessionToSidebar(newSession);
                setCurrentSession(newSession);
                clearChatHistory();
                updateWelcomeMessageForMode('patient');
            } else if (currentMode === 'pdf') {
                const sessionName = prompt('Enter a name for this PDF session:') || `PDF Session ${Date.now()}`;
                const newSession = createPdfSession(sessionName);
                addSessionToSidebar(newSession);
                setCurrentSession(newSession);
                clearChatHistory();
                updateWelcomeMessageForMode('pdf');
            }
            // Ensure only sessions from the current mode are visible
            filterSessionsByMode(currentMode);
        } catch (err) {
            console.error('Failed to create new session:', err);
        }
    }

    /**
     * Send message to query service Lambda function
     * @param {string} message - The user's message
     * @returns {Promise<Object>} AI response from Lambda
     */
    async function sendMessageToServer(message) {
        try {
            // Check if API is configured
            if (API_CONFIG.QUERY_SERVICE_URL === 'YOUR_QUERY_SERVICE_API_GATEWAY_URL') {
                console.error('API Gateway URL not configured - FAILING HARD');
                return await getHardcoreResponse(message);
            }

            console.log('Sending message to Lambda:', message);
            
            const response = await fetch(API_CONFIG.QUERY_SERVICE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    question: message,
                    sessionId: currentSession?.id || 'default-session'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received response from Lambda:', data);

            // Handle different response formats
            if (data.body) {
                // If response is wrapped in a body (common with Lambda proxy integration)
                const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
                return {
                    text: bodyData.answer || bodyData.response || bodyData.message || 'No response received',
                    type: 'normal',
                    sources: bodyData.sources || []
                };
            }

            return {
                text: data.answer || data.response || data.message || 'No response received',
                type: 'normal',
                sources: data.sources || []
            };

        } catch (error) {
            console.error('Error calling Lambda function:', error);
            
            // Fallback to mock response if Lambda fails
            return {
                text: `I apologize, but I'm having trouble connecting to the medical knowledge base right now. Please check that your API Gateway URL is configured correctly.\n\nError: ${error.message}`,
                type: 'error'
            };
        }
    }

    /**
     * Send general medical question (no patient context)
     * @param {string} message - The user's general medical question
     * @returns {Promise<Object>} AI response
     */
    async function sendGeneralMessage(message) {
        try {
            // Check if API is configured
            if (API_CONFIG.QUERY_SERVICE_URL === 'YOUR_QUERY_SERVICE_API_GATEWAY_URL') {
                console.error('API Gateway URL not configured - FAILING HARD');
                return await getHardcoreResponse(message);
            }

            console.log('Sending general message to Lambda:', message);
            
            const response = await fetch(API_CONFIG.QUERY_SERVICE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    question: message,
                    mode: 'general',
                    sessionId: 'general-session'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received general response from Lambda:', data);

            // Handle different response formats
            if (data.body) {
                const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
                return {
                    text: bodyData.answer || bodyData.response || bodyData.message || 'No response received',
                    type: 'normal',
                    sources: bodyData.sources || [],
                    mode: 'general'
                };
            }

            return {
                text: data.answer || data.response || data.message || 'No response received',
                type: 'normal',
                sources: data.sources || [],
                mode: 'general'
            };

        } catch (error) {
            console.error('Error calling Lambda function for general message:', error);
            
            // Fallback to mock response if Lambda fails
            return {
                text: `I apologize, but I'm having trouble connecting to the medical knowledge base right now. Please check that your API Gateway URL is configured correctly.\n\nError: ${error.message}`,
                type: 'error',
                mode: 'general'
            };
        }
    }

    /**
     * Send patient-specific question (with patient context)
     * @param {string} message - The user's patient-specific question
     * @returns {Promise<Object>} AI response
     */
    async function sendPatientMessage(message) {
        try {
            // Check if API is configured
            if (API_CONFIG.QUERY_SERVICE_URL === 'YOUR_QUERY_SERVICE_API_GATEWAY_URL') {
                console.error('API Gateway URL not configured - FAILING HARD');
                return await getHardcoreResponse(message);
            }

            console.log('Sending patient message to Lambda:', message);
            
            // Build session context (lightweight)
            const facts = Array.isArray(currentSession?.contextFacts) ? currentSession.contextFacts : [];
            const recentMessages = Array.isArray(currentSession?.messages)
                ? currentSession.messages.slice(-10).map(m => ({ role: m.sender, content: m.text }))
                : [];

            const response = await fetch(API_CONFIG.QUERY_SERVICE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    question: message,
                    mode: 'patient',
                    sessionId: currentSession?.id || 'patient-session',
                    patientId: currentSession?.patientId,
                    patientName: currentSession?.patientName,
                    sessionContext: {
                        facts,
                        recentMessages
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received patient response from Lambda:', data);

            // Handle different response formats
            if (data.body) {
                const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
                return {
                    text: bodyData.answer || bodyData.response || bodyData.message || 'No response received',
                    type: 'normal',
                    sources: bodyData.sources || [],
                    mode: 'patient',
                    patientContext: {
                        patientId: currentSession?.patientId,
                        patientName: currentSession?.patientName
                    }
                };
            }

            return {
                text: data.answer || data.response || data.message || 'No response received',
                type: 'normal',
                sources: data.sources || [],
                mode: 'patient',
                patientContext: {
                    patientId: currentSession?.patientId,
                    patientName: currentSession?.patientName
                }
            };

        } catch (error) {
            console.error('Error calling Lambda function for patient message:', error);
            
            // Fallback to mock response if Lambda fails
            return {
                text: `I apologize, but I'm having trouble accessing the patient's medical records right now. Please check that your API Gateway URL is configured correctly.\n\nError: ${error.message}`,
                type: 'error',
                mode: 'patient'
            };
        }
    }

    /**
     * Send PDF message (with PDF text extraction)
     * @param {string} message - The user's PDF message
     * @returns {Promise<Object>} AI response
     */
    async function sendPdfMessage(message) {
        try {
            // Check if API is configured
            if (API_CONFIG.QUERY_SERVICE_URL === 'YOUR_QUERY_SERVICE_API_GATEWAY_URL') {
                console.error('API Gateway URL not configured - FAILING HARD');
                return await getHardcoreResponse(message);
            }

            console.log('Sending PDF message to Lambda:', message);
            
            // Extract text from PDF
            const pdfText = await extractPdfText(selectedFiles[0]);
            console.log('Extracted PDF text:', pdfText);

            const response = await fetch(API_CONFIG.QUERY_SERVICE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    question: message,
                    mode: 'pdf',
                    sessionId: currentSession?.id || 'pdf-session',
                    pdfText: pdfText
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received PDF response from Lambda:', data);

            // Handle different response formats
            if (data.body) {
                const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
                return {
                    text: bodyData.answer || bodyData.response || bodyData.message || 'No response received',
                    type: 'normal',
                    sources: bodyData.sources || [],
                    mode: 'pdf'
                };
            }

            return {
                text: data.answer || data.response || data.message || 'No response received',
                type: 'normal',
                sources: data.sources || [],
                mode: 'pdf'
            };

        } catch (error) {
            console.error('Error calling Lambda function for PDF message:', error);
            
            // Fallback to mock response if Lambda fails
            return {
                text: `I apologize, but I'm having trouble processing the PDF right now. Please check that your API Gateway URL is configured correctly.\n\nError: ${error.message}`,
                type: 'error',
                mode: 'pdf'
            };
        }
    }

    /**
     * Extract text from PDF using PDF.js
     * @param {File} pdfFile - The PDF file to extract text from
     * @returns {Promise<string>} Extracted PDF text
     */
    async function extractPdfText(pdfFile) {
        try {
            const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@2.7.570/build/pdf.min.js');
            const pdf = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise;
            const text = await pdf.getTextContent();
            return text.items.map(item => item.str).join('');
        } catch (error) {
            console.error('Error extracting PDF text:', error);
            return '';
        }
    }

    /**
     * HARDCORE response - NO MOCK RESPONSES
     * This will FAIL HARD if API is not configured
     */
    async function getHardcoreResponse(message) {
        throw new Error('API Gateway NOT CONFIGURED - Cannot get AI response. Check API_CONFIG settings.');
    }



    /**
     * Show evidence in the right sidebar
     * @param {string} docId - Document identifier
     * @param {string} page - Page number
     */
    function showEvidence(docId, page) {
        console.log(`Showing evidence from ${docId} on page ${page}`);
        
        // Update document title
        evidenceDocTitle.textContent = docId;
        
        // Update page info
        document.getElementById('page-info').textContent = `Page ${page} of ${Math.ceil(Math.random() * 10) + 1}`;
        
        // Simulate PDF loading
        pdfViewer.innerHTML = `
            <div class="document-viewer">
                <div class="loading-document">
                    <i class="fas fa-file-pdf"></i>
                    <p>Loading <strong>${docId}</strong>...</p>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Show evidence explorer
        evidenceExplorer.classList.add('active');
        dashboardContainer.classList.add('evidence-active');
        
        // Simulate document load completion
        setTimeout(() => {
            pdfViewer.innerHTML = `
                <div class="document-viewer">
                    <div class="document-page">
                        <div class="page-highlight">
                            <h4>Document: ${docId}</h4>
                            <p><strong>Page ${page} - Key Information Highlighted</strong></p>
                            <div class="highlighted-content">
                                <p>This section contains the referenced clinical information that supports the AI analysis. In a production environment, this would display the actual PDF content with highlighted text.</p>
                                <div class="citation-reference">
                                    <p><strong>Referenced Content:</strong> Patient medical record showing relevant clinical data, lab results, or medication information as cited in the AI response.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }, 1500);
    }

    /**
     * Hide evidence explorer
     */
    function hideEvidence() {
        evidenceExplorer.classList.remove('active');
        dashboardContainer.classList.remove('evidence-active');
    }

    // ===== ANIMATION ORCHESTRATION FUNCTIONS =====

    /**
     * Hide the welcome message with smooth animation
     */
    function hideWelcomeMessage() {
        const welcomeMessage = document.getElementById('welcome-message');
        
        if (welcomeMessage && !welcomeMessage.classList.contains('fade-out')) {
            console.log('Hiding welcome message'); // Debug log
            // Add fade-out animation
            welcomeMessage.classList.add('fade-out');
            
            // Remove from DOM after animation
            setTimeout(() => {
                welcomeMessage.remove();
            }, 300); // Match transition duration
        }
    }

    /**
     * Try to answer common patient-specific questions from local session context
     */
    function tryAnswerFromPatientContext(message, session) {
        if (!session) return null;
        const m = message.toLowerCase();
        // Patient name
        if (/(what\s+is\s+)?(the\s+)?patient('s)?\s+name\b/.test(m)) {
            if (session.patientName) {
                return `The patient's name is ${session.patientName}.`;
            }
        }
        // Patient ID
        if (/(what\s+is\s+)?(the\s+)?patient('s)?\s+id\b/.test(m)) {
            if (session.patientId) {
                return `The patient's ID is ${session.patientId}.`;
            }
        }
        // COVID number extraction from remembered facts
        if (/covid\s*(number|no\.?)/.test(m) || /what\s+covid/.test(m)) {
            const factsText = (session.contextFacts || []).join('\n');
            const covidMatch = /covid\s*(?:-|number|no\.?|)\s*(\d{1,3})/i.exec(factsText);
            if (covidMatch && covidMatch[1]) {
                return `The patient has COVID ${covidMatch[1]}.`;
            }
            // Also try to infer from the question itself
            const qMatch = /covid\s*(?:-|number|no\.?|)\s*(\d{1,3})/i.exec(message);
            if (qMatch && qMatch[1]) {
                return `You just mentioned COVID ${qMatch[1]}.`;
            }
            // If we remembered a general "got covid 19" fact without explicit number keyword
            const altMatch = /covid\s*(\d{1,3})/i.exec(factsText);
            if (altMatch && altMatch[1]) {
                return `The patient has COVID ${altMatch[1]}.`;
            }
        }
        return null;
    }

    /**
     * Show AI thinking animation
     */
    function showThinkingIndicator() {
        // Remove any existing thinking indicator
        hideThinkingIndicator();
        
        // Create new thinking indicator
        const thinkingElement = document.createElement('div');
        thinkingElement.classList.add('ai-thinking-container');
        thinkingElement.id = 'ai-thinking-indicator';
        
        thinkingElement.innerHTML = `
            <div class="ai-avatar">AI</div>
            <span class="thinking-text">Clinical Co-pilot is analyzing</span>
            <div class="thinking-dots">
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
            </div>
        `;
        
        // Add to chat log
        chatLog.appendChild(thinkingElement);
        
        // Smooth scroll to show the thinking indicator
        requestAnimationFrame(() => {
            chatLog.scrollTop = chatLog.scrollHeight;
        });
    }

    /**
     * Hide thinking indicator
     */
    function hideThinkingIndicator() {
        const thinkingIndicator = chatLog.querySelector('#ai-thinking-indicator');
        if (thinkingIndicator && thinkingIndicator.parentNode) {
            thinkingIndicator.parentNode.removeChild(thinkingIndicator);
        }
    }

    /**
     * Display AI response with typewriter animation and highlight effects
     * @param {Object} response - AI response object with text and type
     */
    function displayAiResponse(response) {
        // Defensive: ensure any existing thinking indicator is removed before rendering the AI message
        const lingering = chatLog.querySelector('#ai-thinking-indicator');
        if (lingering && lingering.parentNode) {
            lingering.parentNode.removeChild(lingering);
        }
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', 'ai');
        
        const timestamp = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Build a minimal structure; we'll progressively type the text
        const messageHTML = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-robot"></i>
                    <span class="timestamp">Today, ${timestamp}</span>
                </div>
                <div class="message-text-container">
                    <div class="message-text"></div>
                </div>
            </div>
        `;
        messageElement.innerHTML = messageHTML;
        chatLog.appendChild(messageElement);
        const textContainer = messageElement.querySelector('.message-text');
        // Use a dedicated Text node so typing cannot affect other elements
        const textNode = document.createTextNode('');
        textContainer.appendChild(textNode);

        // Defensive: ensure the thinking indicator is not present after message is inserted
        const lingeringAfterAppend = chatLog.querySelector('#ai-thinking-indicator');
        if (lingeringAfterAppend && lingeringAfterAppend.parentNode) {
            lingeringAfterAppend.parentNode.removeChild(lingeringAfterAppend);
        }
        
        // Store AI response in current session if it exists (we'll update HTML after typing)
        let messageData = null;
        if (currentSession) {
            messageData = {
                id: `msg-${Date.now()}`,
                text: response.text,
                sender: 'ai',
                type: response.type || 'normal',
                timestamp: timestamp,
                html: messageElement.outerHTML
            };
            if (!currentSession.messages) currentSession.messages = [];
            currentSession.messages.push(messageData);
            currentSession.messageCount = (currentSession.messageCount || 0) + 1;
            console.log(`Stored AI response in session ${currentSession.id} (will update HTML after typing):`, messageData);
        }
        
        // Safety alerts render immediately with special markup
        if (response.type === 'safety-alert') {
            // Replace container with alert markup
            const alertHTML = createSafetyAlert(response.text);
            textContainer.innerHTML = alertHTML;
            const alertElement = messageElement.querySelector('.safety-alert');
            if (alertElement) alertElement.classList.add('animate-highlight');
            // Update stored HTML
            if (messageData) messageData.html = messageElement.outerHTML;
            // Ensure scroll
            requestAnimationFrame(() => { chatLog.scrollTop = chatLog.scrollHeight; });
            return;
        }
        
        // Sanitize response text to remove unwanted role prefixes or echoed content
        const lastUserMsg = getLastUserMessage();
        const cleaned = cleanAiText(response.text || '', lastUserMsg);

        // Progressive top-to-bottom typing using textContent (respects pre-wrap in CSS)
        typeText(textNode, cleaned, { charsPerTick: 2, intervalMs: 12 }, () => {
            // Do not transform into innerHTML after typing; keep as text to avoid unintended DOM mutations
            if (messageData) {
                messageData.html = messageElement.outerHTML;
            }
        });
        
        // Keep the view scrolled to bottom while typing
        const keepScrolled = () => { chatLog.scrollTop = chatLog.scrollHeight; };
        const scrollInterval = setInterval(keepScrolled, 100);
        // Stop enforcing scroll after a few seconds
        setTimeout(() => clearInterval(scrollInterval), 4000);
    }

    /**
     * Progressive typing utility: appends text to an element's textContent in small chunks
     * Options: { charsPerTick: number, intervalMs: number }
     */
    function typeText(target, text, options = {}, onDone = () => {}) {
        const charsPerTick = options.charsPerTick ?? 2;
        const intervalMs = options.intervalMs ?? 16;
        let idx = 0;
        // Reset only the provided target
        if (target.nodeType === 3) {
            target.nodeValue = '';
        } else {
            target.textContent = '';
        }
        const len = text.length;
        
        const timer = setInterval(() => {
            if (idx >= len) {
                clearInterval(timer);
                onDone();
                return;
            }
            const nextIdx = Math.min(idx + charsPerTick, len);
            // Append next chunk
            const chunk = text.slice(idx, nextIdx);
            if (target.nodeType === 3) {
                target.nodeValue += chunk;
            } else {
                target.textContent += chunk;
            }
            idx = nextIdx;
        }, intervalMs);
    }

    // ===== RESPONSE SANITIZATION HELPERS =====
    /**
     * Get last user message text in current session
     */
    function getLastUserMessage() {
        if (!currentSession || !Array.isArray(currentSession.messages)) return null;
        for (let i = currentSession.messages.length - 1; i >= 0; i--) {
            const m = currentSession.messages[i];
            if (m.sender === 'user' && typeof m.text === 'string' && m.text.trim()) {
                return m.text.trim();
            }
        }
        return null;
    }

    /**
     * Clean AI text by removing role labels like "User:"/"Bot:" and echoed user lines
     */
    function cleanAiText(text, lastUserMsg) {
        let t = String(text ?? '');

        // Remove common role prefixes at line starts
        t = t
            .replace(/^\s*(User|You)\s*:\s?.*$/gmi, '')
            .replace(/^\s*(Bot|Assistant|AI)\s*:\s?/gmi, '')
            .replace(/^\s*(Q|Question)\s*:\s?/gmi, '')
            .replace(/^\s*(A|Answer)\s*:\s?/gmi, '');

        // If the AI echoes the last user message verbatim at the start, remove it
        if (lastUserMsg) {
            const escaped = lastUserMsg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const echoRe = new RegExp('^\\s*' + escaped + '\\s*\\n?', 'i');
            t = t.replace(echoRe, '');
        }

        // Collapse excessive blank lines
        t = t.replace(/\n{3,}/g, '\n\n').trim();

        return t;
    }

    /**
     * Format message content with animation classes
     * @param {string} message - The message text
     * @param {string} type - The message type
     * @returns {string} Formatted HTML with animation classes
     */
    function formatMessageContentWithAnimation(message, type) {
        if (type === 'safety-alert') {
            return createSafetyAlert(message);
        }
        
        // Convert newlines to HTML and preserve formatting
        const formattedMessage = message
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return `<div class="message-text">${formattedMessage}</div>`;
    }

    /**
     * Show loading state (kept for compatibility)
     */
    function showLoadingState() {
        // This function is kept for any legacy calls, but we now use thinking indicator
        showThinkingIndicator();
    }

    /**
     * Hide loading state (kept for compatibility)
     */
    function hideLoadingState() {
        // This function is kept for any legacy calls, but we now use thinking indicator
        hideThinkingIndicator();
    }

    /**
     * Auto-resize textarea based on content
     */
    function autoResizeTextarea() {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    }



    /**
     * Switch to different session (works for both general and patient sessions)
     * @param {HTMLElement} sessionItem - The clicked session item
     */
    function switchSession(sessionItem) {
        // Get session info from data attributes
        const sessionId = sessionItem.dataset.sessionId;
        const patientId = sessionItem.dataset.patient;
        const mode = sessionItem.dataset.mode;
        
        // Find the actual session object from activeSessions
        let targetSession = null;
        
        if (mode === 'general' && sessionId) {
            targetSession = activeSessions.find(session => session.id === sessionId);
        } else if (mode === 'patient' && patientId) {
            targetSession = activeSessions.find(session => session.patientId === patientId);
        } else if (mode === 'pdf' && sessionId) {
            targetSession = activeSessions.find(session => session.id === sessionId);
        }
        
        if (targetSession) {
            // Use the proper setCurrentSession function which handles message restoration
            setCurrentSession(targetSession);
            console.log(`Switched to ${mode} session:`, targetSession);
        } else {
            // Fallback for legacy patient sessions (create a basic session object)
            if (mode === 'patient' && patientId) {
                const patientName = sessionItem.querySelector('.patient-name')?.textContent || 'Unknown Patient';
                
                const legacySession = {
                    id: `patient-${patientId}-${Date.now()}`,
                    patientId: patientId,
                    patientName: patientName,
                    sessionType: 'Clinical Analysis Session',
                    timestamp: new Date(),
                    mode: 'patient',
                    messageCount: 0,
                    messages: [] // Empty messages array for legacy sessions
                };
                
                // Add to activeSessions and set as current
                activeSessions.push(legacySession);
                setCurrentSession(legacySession);
                
                console.log(`Created legacy patient session for: ${patientName} (${patientId})`);
            } else if (mode === 'pdf' && sessionId) {
                const pdfSession = {
                    id: sessionId,
                    sessionName: sessionItem.querySelector('.session-title')?.textContent || 'Unknown PDF Session',
                    sessionType: 'PDF Analysis Session',
                    timestamp: new Date(),
                    mode: 'pdf',
                    messageCount: 0,
                    messages: [] // Empty messages array for PDF sessions
                };
                
                // Add to activeSessions and set as current
                activeSessions.push(pdfSession);
                setCurrentSession(pdfSession);
                
                console.log(`Created PDF session: ${pdfSession.sessionName} (${sessionId})`);
            } else {
                console.error('Could not find or create session for:', { sessionId, patientId, mode });
            }
        }
    }

    /**
     * Clear chat history
     */
    function clearChatHistory() {
        // Restore the original welcome message card
        chatLog.innerHTML = `
            <div id="welcome-message" class="welcome-message-card">
                <div class="welcome-header">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M24 4L40 12V36L24 44L8 36V12L24 4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M24 24L40 12L24 4L8 12L24 24Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M8 36L24 24L40 36" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M24 44V24" stroke="currentColor" stroke-width="3"/>
                    </svg>
                    <h2>Welcome to Clinical Co-pilot</h2>
                </div>
                <p class="welcome-description">
                    Your AI-powered clinical assistant is ready to help you analyze patient data, 
                    identify trends, and provide evidence-based recommendations. Start by selecting 
                    a patient or creating a new session. <a href="#" class="cite-link" data-doc="welcome_doc.pdf" data-page="1">[Test Reference]</a>
                </p>
            </div>
        `;
    }

    /**
     * Create new general session (auto-created from first message)
     * @param {string} firstMessage - The first message to generate session name from
     * @returns {Object} New general session
     */
    function createGeneralSession(firstMessage) {
        // Generate session name from first message (truncate if too long)
        const sessionName = firstMessage.length > 30 
            ? firstMessage.substring(0, 30) + '...' 
            : firstMessage;
        
        const newSession = {
            id: `general-${Date.now()}`,
            sessionName: sessionName,
            sessionType: 'General Medical Chat',
            timestamp: new Date(),
            mode: 'general',
            messageCount: 1,
            messages: [] // Store chat messages
        };
        
        // Add to sessions list
        activeSessions.push(newSession);
        
        console.log(`Created new general session: ${sessionName}`);
        return newSession;
    }

    /**
     * Create new patient session
     * @param {string} patientName - The patient's name
     * @param {string} patientId - The patient's ID
     * @returns {Object} New patient session
     */
    function createPatientSession(patientName, patientId) {
        const newSession = {
            id: `patient-${Date.now()}`,
            patientId: patientId,
            patientName: patientName,
            sessionType: 'Clinical Analysis Session',
            timestamp: new Date(),
            mode: 'patient',
            messageCount: 0,
            messages: [], // Store chat messages
            contextFacts: [] // Store patient-specific facts remembered in this session
        };
        
        // Add to sessions list
        activeSessions.push(newSession);
        
        console.log(`Created new patient session: ${patientName} (${patientId})`);
        return newSession;
    }

    /**
     * Create new PDF session
     * @param {string} sessionName - The session name
     * @returns {Object} New PDF session
     */
    function createPdfSession(sessionName) {
        const newSession = {
            id: `pdf-${Date.now()}`,
            sessionName: sessionName,
            sessionType: 'PDF Analysis Session',
            timestamp: new Date(),
            mode: 'pdf',
            messageCount: 0,
            messages: [] // Store chat messages
        };
        
        // Add to sessions list
        activeSessions.push(newSession);
        
        console.log(`Created new PDF session: ${sessionName}`);
        return newSession;
    }

    /**
     * Create use case expansion demo sessions
     * Automatically generates 4 demo sessions with predefined content
     */
    function createUseCaseExpansionSessions() {
        // Session 1: Longitudinal History (Deep Data)
        const longitudinalSession = {
            id: `longitudinal-${Date.now()}`,
            patientName: 'Sarah Johnson',
            patientId: 'P2024-001',
            sessionName: 'Longitudinal History (Deep Data)',
            sessionType: 'Patient Progression Analysis',
            timestamp: new Date(),
            mode: 'patient',
            messageCount: 4,
            messages: [
                {
                    role: 'user',
                    content: 'Show me the complete medical history for patient Sarah Johnson from 2020-2024',
                    timestamp: new Date(Date.now() - 86400000)
                },
                {
                    role: 'assistant',
                    content: 'I can see Sarah Johnson\'s comprehensive 4-year medical journey:\n\n**2020-2021: Initial Diagnosis Phase**\n- Type 2 Diabetes diagnosis (HbA1c: 8.2%)\n- Hypertension stage 1 (BP: 145/92)\n- Started Metformin 500mg BID\n\n**2021-2022: Treatment Optimization**\n- HbA1c improved to 6.8% with medication adjustment\n- BP stabilized at 128/82 with Lisinopril\n- Weight loss of 15 lbs through lifestyle changes\n\n**2022-2023: Complication Management**\n- Early diabetic retinopathy detected\n- Microalbuminuria: 45 mg/g (mild elevation)\n- Added ACE inhibitor for renal protection\n\n**2023-2024: Stable Maintenance**\n- HbA1c maintained at 6.5-6.7%\n- Retinopathy stable with annual monitoring\n- Microalbuminuria decreased to 28 mg/g\n\n**Key Trends:**\n- Consistent improvement in glycemic control\n- Successful blood pressure management\n- Early complication detection and intervention',
                    timestamp: new Date(Date.now() - 86300000)
                },
                {
                    role: 'user',
                    content: 'What patterns do you see in her lab values over time?',
                    timestamp: new Date(Date.now() - 43200000)
                },
                {
                    role: 'assistant',
                    content: 'Analyzing Sarah\'s longitudinal lab patterns reveals several important trends:\n\n**Glucose Control Trajectory:**\n- HbA1c: 8.2% → 7.1% → 6.8% → 6.5% (steady improvement)\n- Fasting glucose: 165 → 128 → 118 → 112 mg/dL\n- Post-prandial peaks reduced by 35%\n\n**Lipid Profile Evolution:**\n- Total cholesterol: 245 → 198 → 186 → 175 mg/dL\n- HDL improved: 38 → 42 → 48 → 52 mg/dL\n- Triglycerides: 285 → 220 → 165 → 128 mg/dL\n\n**Kidney Function Monitoring:**\n- Creatinine stable: 0.9 → 0.9 → 1.0 → 1.0 mg/dL\n- eGFR: >90 → >90 → 85 → 82 mL/min/1.73m²\n- Microalbuminuria trend: 45 → 38 → 32 → 28 mg/g\n\n**Inflammatory Markers:**\n- hs-CRP: 4.2 → 2.8 → 1.9 → 1.4 mg/L\n- ESR: 22 → 18 → 14 → 12 mm/hr\n\n**Clinical Insights:**\n- Excellent medication adherence evidenced by consistent improvements\n- Lifestyle modifications highly effective\n- Early nephropathy showing regression\n- Cardiovascular risk significantly reduced',
                    timestamp: new Date(Date.now() - 43100000)
                }
            ],
            contextFacts: [
                'Sarah Johnson, DOB: 1975-03-15, Type 2 Diabetes since 2020',
                'Excellent medication adherence with 95% compliance rate',
                'Progressive improvement in all metabolic parameters',
                'Early diabetic complications successfully managed'
            ]
        };

        // Session 2: Format Diversity (Show Robustness)
        const formatSession = {
            id: `format-${Date.now()}`,
            patientName: 'Jennifer Walsh',
            patientId: 'P2024-456',
            sessionName: 'Format Diversity (Show Robustness)',
            sessionType: 'Multi-Format Document Analysis',
            timestamp: new Date(),
            mode: 'patient',
            messageCount: 3,
            messages: [
                {
                    role: 'user',
                    content: 'Process this mixed batch of medical documents: ECG reports, lab results, imaging studies, and clinical notes',
                    timestamp: new Date(Date.now() - 172800000)
                },
                {
                    role: 'assistant',
                    content: 'I\'ve successfully processed your diverse medical document collection. Here\'s the comprehensive analysis:\n\n**📊 LABORATORY REPORTS (PDF)**\n```\nCBC with Differential:\n- WBC: 7.2 K/uL [4.0-11.0]\n- RBC: 4.1 M/uL [4.2-5.9] ↓\n- Hemoglobin: 11.8 g/dL [12.0-16.0] ↓\n- Hematocrit: 35% [36-48%] ↓\n- Platelets: 285 K/uL [150-400]\n```\n\n**📈 ECG INTERPRETATION (Digital Format)**\n```\nRate: 78 bpm (Normal sinus rhythm)\nRhythm: Regular\nAxis: Normal (+45°)\nIntervals:\n  - PR: 160ms [120-200]\n  - QRS: 88ms [60-100]\n  - QTc: 412ms [350-440]\nFindings: Normal ECG, no acute changes\n```\n\n**🏥 IMAGING STUDIES (DICOM + Reports)**\n- **Chest X-ray**: Clear lung fields, normal cardiac silhouette\n- **CT Abdomen**: Mild fatty liver, no masses or obstruction\n- **MRI Brain**: Age-appropriate changes, no acute pathology\n\n**📝 CLINICAL NOTES (Free Text)**\n**Progress Note - 2024-01-15**\n"Patient reports improved symptoms following medication adjustment. Physical examination reveals stable vital signs. Continued monitoring recommended."\n\n**Cross-Document Correlation:**\n- Mild anemia correlates with clinical fatigue complaints\n- Normal imaging supports conservative management approach\n- Stable ECG consistent with benign clinical presentation',
                    timestamp: new Date(Date.now() - 172700000)
                },
                {
                    role: 'user',
                    content: 'Can you extract medication information from these different formats and create a unified medication list?',
                    timestamp: new Date(Date.now() - 86400000)
                },
                {
                    role: 'assistant',
                    content: '**UNIFIED MEDICATION RECONCILIATION**\n\nExtracted from multiple document formats:\n\n**🎯 ACTIVE MEDICATIONS**\n1. **Metformin** 500mg BID (from clinical notes)\n2. **Lisinopril** 10mg daily (from discharge summary)\n3. **Atorvastatin** 20mg nightly (from medication list)\n4. **Aspirin** 81mg daily (from cardiology note)\n\n**📋 RECENT CHANGES**\n- **Added**: Vitamin D3 2000 IU daily (per endocrine notes)\n- **Discontinued**: Ibuprofen (per renal consultation)\n- **Adjusted**: Metformin increased from 250mg to 500mg BID\n\n**⚠️ POTENTIAL INTERACTIONS**\n- Lisinopril + NSAIDs (avoid combination)\n- Metformin + contrast dye (hold 48hrs pre-procedure)\n\n**📊 COMPLIANCE INDICATORS**\n- Refill history: 85% compliant (pharmacy data)\n- Patient reports occasional missed doses\n- Pill organizer use confirmed\n\n**Format Processing Capabilities Demonstrated:**\n✅ Structured tables (lab reports)\n✅ Free text parsing (clinical notes)\n✅ Image OCR (scanned documents)\n✅ Digital format integration (ECG XML)\n✅ Cross-reference validation (multiple sources)',
                    timestamp: new Date(Date.now() - 86300000)
                }
            ]
        };

        // Session 3: Content Complexity (Show AI Intelligence)
        const complexitySession = {
            id: `complexity-${Date.now()}`,
            patientName: 'Leslie Terry',
            patientId: 'P2024-789',
            sessionName: 'Among Leslie Terry\'s 5–7 PDF Content Complexity (Show AI\'s Intelligence)',
            sessionType: 'Complex Medical Case Analysis',
            timestamp: new Date(),
            mode: 'patient',
            messageCount: 2,
            messages: [
                {
                    role: 'user',
                    content: 'Analyze Leslie Terry\'s complex case with 5-7 interconnected PDFs: oncology treatment plan, genetic testing, multiple specialist consultations, and research trial data',
                    timestamp: new Date(Date.now() - 259200000)
                },
                {
                    role: 'assistant',
                    content: '**COMPLEX MULTI-DISCIPLINARY ANALYSIS: LESLIE TERRY**\n\n**🧬 GENETIC PROFILE ANALYSIS**\n```\nBRCA1: Pathogenic variant c.68_69delAG\nBRCA2: Wild type\nTP53: Variant of uncertain significance\nCHEK2: Likely pathogenic\nGenomic Signature: Homologous recombination deficiency positive\n```\n\n**🎯 ONCOLOGY TREATMENT EVOLUTION**\n**Phase 1 - Neoadjuvant Therapy (Months 1-4)**\n- Carboplatin + Paclitaxel (q3weeks x 4 cycles)\n- Pathological response: Partial (30% residual disease)\n\n**Phase 2 - Surgical Management (Month 5)**\n- Modified radical mastectomy\n- Sentinel lymph node: 2/3 positive\n- Final staging: ypT2N1M0\n\n**Phase 3 - Adjuvant Treatment (Months 6-9)**\n- Dose-dense AC-T protocol\n- Radiation therapy (50 Gy + boost)\n\n**🔬 RESEARCH INTEGRATION**\n**Clinical Trial Eligibility Analysis:**\n- NCT0451234: PARP inhibitor maintenance ✅ Eligible\n- NCT0455678: Immunotherapy combination ✅ Eligible\n- NCT0459012: Targeted therapy trial ⚠️ Pending biomarker results\n\n**🩺 SPECIALIST CONSULTATION SYNTHESIS**\n**Cardiology**:\n"Baseline EF 55%, no contraindication to anthracyclines. Recommend cardiac monitoring during treatment."\n\n**Genetic Counseling**:\n"High-risk hereditary syndrome. Recommend family testing and prophylactic considerations."\n\n**Nutrition**:\n"Weight management critical. BMI 31. Recommend Mediterranean diet pattern."\n\n**Psychology**:\n"Treatment-related anxiety. Recommend CBT and support groups."\n\n**🎯 INTEGRATED TREATMENT RECOMMENDATIONS**\n1. **Immediate**: Enroll in PARP inhibitor maintenance trial\n2. **Monitoring**: q3month CA-15-3 and imaging\n3. **Supportive**: Cardioprotection with ACE inhibitors\n4. **Long-term**: Risk-reduction bilateral salpingo-oophorectomy\n\n**📊 PREDICTIVE MODELING**\n- 5-year disease-free survival: 72% (based on genomic profile)\n- Recurrence risk: Intermediate (modified by HRD status)\n- Treatment benefit score: High (platinum-sensitive phenotype)\n\n**🔍 COMPLEX PATTERN RECOGNITION**\nThe multi-layered analysis reveals:\n- Platinum sensitivity despite partial response\n- HRD positivity suggests PARP inhibitor benefit\n- Hereditary component requiring family cascade testing\n- Multi-modal treatment approach optimization',
                    timestamp: new Date(Date.now() - 259100000)
                }
            ]
        };

        // Session 4: Cross-Document Connectivity (Show Integration)
        const connectivitySession = {
            id: `connectivity-${Date.now()}`,
            patientName: 'Michael Rodriguez',
            patientId: 'P2024-123',
            sessionName: 'Cross-Document Connectivity (Show Integration)',
            sessionType: 'Integrated Document Analysis',
            timestamp: new Date(),
            mode: 'patient',
            messageCount: 3,
            messages: [
                {
                    role: 'user',
                    content: 'Cross-reference information across multiple patient documents to identify connections and discrepancies',
                    timestamp: new Date(Date.now() - 345600000)
                },
                {
                    role: 'assistant',
                    content: '**CROSS-DOCUMENT CONNECTIVITY ANALYSIS**\n\n**🔗 PATIENT: MICHAEL RODRIGUEZ (MRN: 123456)**\n\n**Document Set Analyzed:**\n1. Emergency Department Note (2024-01-15)\n2. Discharge Summary (2024-01-17)\n3. Primary Care Follow-up (2024-01-20)\n4. Cardiology Consultation (2024-01-22)\n5. Laboratory Results (2024-01-15 & 2024-01-21)\n\n**✅ CONSISTENT CONNECTIONS:**\n**Chief Complaint → Diagnosis → Treatment:**\n- ED: "Chest pain, 8/10, radiating to left arm"\n- Discharge: "NSTEMI, troponin peak 2.8 ng/mL"\n- Cardiology: "Coronary angiography recommended"\n- PCP: "Cardiac catheterization scheduled"\n\n**Medication Reconciliation:**\n- ED: Aspirin 325mg, Clopidogrel 600mg\n- Discharge: Aspirin 81mg daily, Clopidogrel 75mg daily\n- Cardiology: Confirmed dual antiplatelet therapy\n- PCP: Patient reports medication compliance\n\n**⚠️ CRITICAL DISCREPANCIES IDENTIFIED:**\n**Allergy Documentation:**\n- ED Notes: "No known drug allergies"\n- Discharge Summary: "NKDA"\n- Cardiology Note: "Penicillin allergy - rash"\n- **⚡ ACTION REQUIRED**: Clarify allergy status\n\n**Laboratory Value Inconsistencies:**\n- ED Troponin: 2.8 ng/mL (documented)\n- Discharge Summary: 1.9 ng/mL (incorrect)\n- Cardiology: 2.8 ng/mL (correct)\n\n**Timeline Discrepancies:**\n- Symptom onset: ED says "3 hours", PCP says "6 hours"\n- Medication timing: Different start dates documented',
                    timestamp: new Date(Date.now() - 345500000)
                },
                {
                    role: 'user',
                    content: 'Generate a unified timeline and flag any safety concerns from these cross-document connections',
                    timestamp: new Date(Date.now() - 259200000)
                },
                {
                    role: 'assistant',
                    content: '**UNIFIED PATIENT TIMELINE & SAFETY ANALYSIS**\n\n**📅 CHRONOLOGICAL EVENT SEQUENCE**\n```\nJan 15, 08:30  →  Symptom onset (chest pain)\nJan 15, 11:45  →  ED arrival, initial assessment\nJan 15, 12:15  →  ECG: ST depressions V2-V4\nJan 15, 12:30  →  Troponin I: 2.8 ng/mL (confirmed)\nJan 15, 13:00  →  Cardiology consultation\nJan 15, 14:30  →  Dual antiplatelet therapy initiated\nJan 17, 09:00  →  Discharge planning\nJan 20, 10:15  →  Primary care follow-up\nJan 22, 14:00  →  Cardiology consultation\n```\n\n**🚨 SAFETY FLAGS & RECOMMENDATIONS**\n\n**🔴 CRITICAL (Immediate Action Required):**\n1. **Allergy Discrepancy**: Penicillin allergy status unclear\n   - Risk: Anaphylaxis if beta-lactam antibiotics needed\n   - Action: Immediate allergy clarification required\n\n**🟡 MODERATE (Address Within 24 Hours):**\n2. **Medication Timing**: Aspirin start time inconsistent\n   - ED: 15:30 vs Discharge: 14:00\n   - Risk: Documentation error, potential dosing confusion\n\n3. **Troponin Value**: Discharge summary incorrect (1.9 vs 2.8)\n   - Risk: Underestimation of cardiac injury severity\n\n**🟢 ADMINISTRATIVE (Correct Within 1 Week):**\n4. **Symptom Duration**: 3 vs 6 hours discrepancy\n   - Impact: Treatment window documentation\n\n**🔗 INTEGRATED CLINICAL INSIGHTS**\n- **Pattern Recognition**: Consistent STEMI management across documents\n- **Quality Gap**: Allergy documentation needs standardization\n- **Communication**: Effective handoff between specialties\n- **Outcome**: Appropriate care despite documentation issues\n\n**📋 RECOMMENDED ACTIONS**\n1. Implement standardized allergy documentation protocol\n2. Create cross-document validation checkpoints\n3. Establish critical value verification process\n4. Develop integrated timeline auto-generation',
                    timestamp: new Date(Date.now() - 259100000)
                }
            ]
        };

        // Add all sessions to the active sessions list
        const demoSessions = [longitudinalSession, formatSession, complexitySession, connectivitySession];
        
        demoSessions.forEach(session => {
            // Clean session name to remove undefined references
            if (session.sessionName && session.sessionName.includes('undefined')) {
                session.sessionName = session.sessionName.replace(/undefined/g, 'Patient');
            }
            
            // Ensure session name is properly set
            if (!session.sessionName || session.sessionName.trim() === '') {
                session.sessionName = 'Medical Chat Session';
            }
            
            // Clean any potential undefined messages
            if (session.messages && session.messages.length > 0) {
                session.messages = session.messages.filter(msg => 
                    msg && 
                    msg.content && 
                    typeof msg.content === 'string' && 
                    msg.content.trim() !== '' &&
                    msg.role &&
                    (msg.role === 'user' || msg.role === 'assistant')
                );
                session.messageCount = session.messages.length;
            }
            
            activeSessions.push(session);
            addSessionToSidebar(session);
        });

        console.log('Use case expansion sessions created successfully!');
        
        // Switch to the first session
        setCurrentSession(longitudinalSession);
        
        // Show success notification
        if (typeof showNotification === 'function') {
            showNotification('✨ 4 demo sessions created successfully!', 'success');
        }
        
        return demoSessions;
    }

    /**
     * Add session to sidebar
     * @param {Object} session - Session object
     */
    function addSessionToSidebar(session) {
        const sessionHistory = document.getElementById('session-history');
        
        // Remove empty state if it exists
        const emptyState = sessionHistory.querySelector('.no-sessions');
        if (emptyState) {
            emptyState.remove();
        }
        
        // Create session item
        const sessionItem = document.createElement('li');
        sessionItem.className = 'session-item';
        
        // Set data attributes based on session type
        if (session.mode === 'general') {
            sessionItem.dataset.sessionId = session.id;
            sessionItem.dataset.mode = 'general';
        } else if (session.mode === 'patient') {
            sessionItem.dataset.patient = session.patientId;
            sessionItem.dataset.mode = 'patient';
        } else if (session.mode === 'pdf') {
            sessionItem.dataset.sessionId = session.id;
            sessionItem.dataset.mode = 'pdf';
        }
        
        // Generate HTML based on session type
        let sessionHTML = '';
        if (session.mode === 'general') {
            sessionHTML = `
                <div class="session-info">
                    <div class="session-name">${session.sessionName}</div>
                    <small class="session-summary">General Medical Chat</small>
                </div>
                <div class="session-status">
                    <span class="status-dot general"></span>
                </div>
            `;
        } else if (session.mode === 'patient') {
            sessionHTML = `
                <div class="session-info">
                    <div class="patient-name">${session.patientName}</div>
                    <div class="patient-id">ID: ${session.patientId}</div>
                    <small class="session-summary">Patient Analysis Session</small>
                </div>
                <div class="session-status">
                    <span class="status-dot patient"></span>
                </div>
            `;
        } else if (session.mode === 'pdf') {
            sessionHTML = `
                <div class="session-icon pdf">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 2H9L13 6V14C13 14.5523 12.5523 15 12 15H3C2.44772 15 2 14.5523 2 14V3C2 2.44772 2.44772 2 3 2Z" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M9 2V6H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="session-info">
                    <div class="session-title">${session.sessionName}</div>
                    <small class="session-summary">PDF Analysis Session</small>
                </div>
                <div class="session-status">
                    <span class="status-dot"></span>
                </div>
            `;
        }
        
        sessionItem.innerHTML = sessionHTML;
        
        // Click handler is managed by the global event listener that calls switchSession()
        
        sessionHistory.appendChild(sessionItem);
    }
    
    /**
     * Set current active session
     * @param {Object} session - Session object
     */
    function setCurrentSession(session) {
        currentSession = session;
        
        // Update header based on session type
        if (currentMode === 'patient' && session && session.patientId) {
            currentPatientElement.textContent = `${session.patientName} (${session.patientId})`;
            currentPatientElement.style.display = 'block';
        } else if (currentMode === 'general' && session) {
            currentPatientElement.textContent = `General Chat: ${session.sessionName}`;
            currentPatientElement.style.display = 'block';
        } else {
            currentPatientElement.style.display = 'none';
        }
        
        // Update active state in sidebar
        document.querySelectorAll('.session-item').forEach(item => {
            item.classList.remove('active');
            const statusDot = item.querySelector('.status-dot');
            if (statusDot) {
                statusDot.classList.remove('active');
            }
        });
        
        // Find and activate the correct session item
        if (session) {
            let activeItem;
            if (session.mode === 'general') {
                activeItem = document.querySelector(`[data-session-id="${session.id}"]`);
            } else if (session.patientId) {
                activeItem = document.querySelector(`[data-patient="${session.patientId}"]`);
            }
            
            if (activeItem) {
                activeItem.classList.add('active');
                const statusDot = activeItem.querySelector('.status-dot');
                if (statusDot) {
                    statusDot.classList.add('active');
                }
            }
        }
        
        // Clear chat when switching sessions
        clearCurrentChat();
        
        // Restore chat messages if session has messages
        if (session && session.messages && session.messages.length > 0) {
            // Clean messages to remove any undefined content
            const cleanMessages = session.messages.filter(msg => 
                msg && 
                msg.content && 
                typeof msg.content === 'string' && 
                msg.content.trim() !== '' &&
                msg.role &&
                (msg.role === 'user' || msg.role === 'assistant')
            );
            
            if (cleanMessages.length > 0) {
                session.messages = cleanMessages;
                restoreSessionMessages(session);
            }
        }
        
        // Update welcome message based on mode and session
        if (currentMode === 'patient' && session) {
            updateWelcomeMessageForMode('patient');
        } else if (currentMode === 'general') {
            updateWelcomeMessageForMode('general');
        }
    }

    // ===== GLOBAL FUNCTIONS FOR BUTTON HANDLERS =====
    
    /**
     * Handle review records button click
     */
    window.reviewRecords = function() {
        alert('Review Records: This would open a detailed review interface for the flagged records.');
    };

    /**
     * Handle flag for review button click
     */
    window.flagForReview = function() {
        alert('Flag for Review: This would create an alert for the medical team to review the contradiction.');
    };

    // ===== FILE HANDLING FUNCTIONS =====
    
    /**
     * Handle file selection (show preview, don't upload yet)
     * @param {Array} files - Array of selected files
     */
    function handleFileSelection(files) {
        // Validate files
        const pdfFiles = files.filter(file => 
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        );
        
        if (pdfFiles.length === 0) {
            alert('Please select only PDF files.');
            return;
        }
        
        if (pdfFiles.length > 5) {
            alert('Maximum 5 files allowed per upload.');
            return;
        }
        
        // Check file sizes
        const oversizedFiles = pdfFiles.filter(file => file.size > 10 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            alert(`File(s) too large: ${oversizedFiles.map(f => f.name).join(', ')}. Maximum size is 10MB.`);
            return;
        }
        
        // Add to selected files
        selectedFiles = [...selectedFiles, ...pdfFiles];
        
        // Remove duplicates based on name and size
        selectedFiles = selectedFiles.filter((file, index, array) => 
            array.findIndex(f => f.name === file.name && f.size === file.size) === index
        );
        
        // Update display
        updateFileDisplay();
        
        // Reset file input
        fileInput.value = '';
    }

    /**
     * Update the file display interface
     */
    function updateFileDisplay() {
        if (selectedFiles.length === 0) {
            // Hide preview, show normal chat
            selectedFilesPreview.style.display = 'none';
            userInput.placeholder = 'Upload medical documents or ask questions about patient records...';
        } else {
            // Show preview above chat
            selectedFilesPreview.style.display = 'block';
            userInput.placeholder = `Press Enter to upload ${selectedFiles.length} file(s) or type a message...`;
            
            // Create rounded card/pill design for each file
            filesList.innerHTML = selectedFiles.map((file, index) => `
                <div class="file-card">
                    <svg class="file-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9.5 1.5L14 6V14.5C14 14.7761 13.7761 15 13.5 15H2.5C2.22386 15 2 14.7761 2 14.5V1.5C2 1.22386 2.22386 1 2.5 1H9.5Z" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M9.5 1.5V6H14" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M5 8H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        <path d="M5 11H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <span class="file-name" title="${file.name}">${file.name}</span>
                    <button class="remove-file-btn" onclick="removeFile(${index})" title="Remove file">
                        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            `).join('');
            
            // Add clear all button if there are multiple files
            if (selectedFiles.length > 1) {
                filesList.innerHTML += `
                    <button class="clear-files-btn" onclick="clearSelectedFiles()">
                        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        Clear All
                    </button>
                `;
            }
        }
    }

    /**
     * Clear all selected files
     */
    function clearSelectedFiles() {
        selectedFiles = [];
        updateFileDisplay();
    }

    /**
     * Remove a specific file from selection
     * @param {number} index - Index of file to remove
     */
    window.removeFile = function(index) {
        selectedFiles.splice(index, 1);
        updateFileDisplay();
    };

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    /**
     * Handle file upload process
     * @param {Array} files - Array of selected files
     */
    async function handleFileUpload(files) {
        // Validate files
        const pdfFiles = files.filter(file => 
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        );
        
        if (pdfFiles.length === 0) {
            showUploadError('Please select only PDF files.');
            return;
        }
        // In General mode, disallow uploads via UI safeguard
        if (currentMode === 'general') {
            alert('File uploads are disabled in General mode. Switch to Patient or PDF mode.');
            clearSelectedFiles();
            return;
        }

        // PDF mode: extract and summarize locally without S3 upload
        if (currentMode === 'pdf') {
            try {
                hideWelcomeMessage();
                showUploadProgress();
                if (pdfFiles.length > 1) {
                    addMessageToLog('Multiple files selected. Processing the first PDF only for now.', 'system');
                }
                const file = pdfFiles[0];

                // Ensure a PDF session exists
                if (!currentSession || currentSession.mode !== 'pdf') {
                    const newSession = {
                        id: `pdf-${Date.now()}`,
                        sessionName: file.name,
                        sessionType: 'PDF Analysis Session',
                        timestamp: new Date(),
                        mode: 'pdf',
                        messageCount: 0,
                        messages: []
                    };
                    activeSessions.push(newSession);
                    addSessionToSidebar(newSession);
                    setCurrentSession(newSession);
                }

                addMessageToLog(`Extracting text from "${file.name}"...`, 'system');
                let extractedText = await extractTextFromPdf(file);
                if (!extractedText || extractedText.trim().length < 50) {
                    addMessageToLog('No selectable text found or text is too short. Trying OCR (this may take a bit longer)...', 'system');
                    try {
                        const ocrText = await ocrExtractTextFromPdf(file);
                        if (ocrText && ocrText.trim().length >= 50) {
                            extractedText = ocrText;
                        } else {
                            addMessageToLog('OCR could not extract meaningful text from the PDF.', 'system');
                        }
                    } catch (ocrErr) {
                        console.error('OCR error:', ocrErr);
                        addMessageToLog(`OCR failed: ${ocrErr.message}`, 'system');
                    }
                }
                if (extractedText && extractedText.trim().length > 0) {
                    // Summarize locally into a structured clinical-style overview
                    addMessageToLog(`Summarizing extracted text from "${file.name}"...`, 'system');
                    const summary = summarizeExtractedText(extractedText, file.name);
                    displayAiResponse({ text: summary, type: 'normal', mode: 'pdf' });
                } else {
                    addMessageToLog('Sorry, I could not extract any text from this PDF. If it is a scanned document, ensure the scan is clear and well-lit.', 'system');
                }
            } catch (err) {
                console.error('PDF processing error:', err);
                showUploadError(`PDF processing failed: ${err.message}`);
            } finally {
                hideUploadProgress();
                clearSelectedFiles();
                fileInput.value = '';
            }
            return;
        }

        if (pdfFiles.length > 5) {
            showUploadError('Maximum 5 files allowed per upload.');
            return;
        }
        
        // Check file sizes
        const oversizedFiles = pdfFiles.filter(file => file.size > 10 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            showUploadError(`File(s) too large: ${oversizedFiles.map(f => f.name).join(', ')}. Maximum size is 10MB.`);
            return;
        }
        
        // Hide welcome message when user uploads files
        hideWelcomeMessage();
        
        // Show progress
        showUploadProgress();
        
        try {
            // Convert files to base64 for Lambda
            const filesData = await Promise.all(
                pdfFiles.map(async (file) => {
                    const base64Content = await fileToBase64(file);
                    return {
                        filename: file.name,
                        content: base64Content,
                        size: file.size
                    };
                })
            );
            
            // Upload files directly to S3 (Amplify approach) - UPDATED WITH PROPER METADATA HANDLING
        const uploadResult = await uploadFilesToS3Direct(pdfFiles);
            
            // Show success message in chat
            showUploadSuccessInChat(uploadResult);
            
            // Clear selected files and return to drop zone
            clearSelectedFiles();
            
            // Reset file input
            fileInput.value = '';
            
        } catch (error) {
            console.error('Upload error:', error);
            showUploadError(`Upload failed: ${error.message}`);
        } finally {
            hideUploadProgress();
        }
    }

    /**
     * Extract text from a PDF File object using PDF.js
     * @param {File} file
     * @returns {Promise<string>} Extracted text
     */
    async function extractTextFromPdf(file) {
        if (!window.pdfjsLib) throw new Error('PDF.js library not loaded');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            fullText += strings.join(' ') + '\n\n';
        }
        // Normalize whitespace
        return fullText.replace(/\s+/g, ' ').replace(/\n\s*/g, '\n').trim();
    }

    /**
     * Send PDF summary prompt to backend using existing query endpoint
     * @param {string} prompt
     * @returns {Promise<Object>} AI response
     */
    async function sendPdfSummary(prompt, extractedText = '', filename = '') {
        try {
            const response = await fetch(API_CONFIG.QUERY_SERVICE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    question: prompt,
                    mode: 'pdf',
                    task: 'summarize_pdf',
                    sessionId: currentSession?.id || `pdf-${Date.now()}`,
                    pdfText: extractedText,
                    filename: filename
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (data.body) {
                const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
                return {
                    text: bodyData.answer || bodyData.response || bodyData.message || 'No response received',
                    type: 'normal',
                    sources: bodyData.sources || [],
                    mode: 'pdf'
                };
            }
            return {
                text: data.answer || data.response || data.message || 'No response received',
                type: 'normal',
                sources: data.sources || [],
                mode: 'pdf'
            };
        } catch (error) {
            console.error('Error calling Lambda for PDF summary:', error);
            return {
                text: `I couldn't summarize the PDF due to a connection error. Please try again.\n\nError: ${error.message}`,
                type: 'error',
                mode: 'pdf'
            };
        }
    }

    /**
     * Show upload success message in chat
     * @param {Object} result - Upload result
     */
    function showUploadSuccessInChat(result) {
        const { successful_uploads, total_files, files } = result;
        
        let messageContent = '';
        if (successful_uploads === total_files) {
            messageContent = `
                <div class="upload-success-message">
                    <div class="success-header">
                        <i class="fas fa-check-circle"></i>
                        <strong>Successfully uploaded ${successful_uploads} document(s)</strong>
                    </div>
                    <div class="uploaded-files">
                        ${files.filter(f => f.status === 'success').map(file => `
                            <div class="uploaded-file">
                                <i class="fas fa-file-pdf"></i>
                                <span>${file.filename}</span>
                                <small>(${formatFileSize(file.size)})</small>
                            </div>
                        `).join('')}
                    </div>
                    <p><em>Documents are being processed and will be available for analysis shortly.</em></p>
                </div>
            `;
        } else {
            messageContent = `
                <div class="upload-partial-message">
                    <div class="partial-header">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Upload completed: ${successful_uploads}/${total_files} files successful</strong>
                    </div>
                    ${files.map(file => `
                        <div class="uploaded-file ${file.status}">
                            <i class="fas fa-${file.status === 'success' ? 'check-circle' : 'times-circle'}"></i>
                            <span>${file.filename}</span>
                            ${file.error ? `<small class="error">${file.error}</small>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        addMessageToLog(messageContent, 'system');
    }

    /**
     * Convert file to base64 string
     * @param {File} file - File to convert
     * @returns {Promise<string>} Base64 string without data URL prefix
     */
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Upload files directly to S3 using AWS SDK (Amplify approach)
     * @param {Array} files - Array of files to upload
     * @returns {Promise<Object>} Upload results
     */
    async function uploadFilesToS3Direct(files) {
        try {
            const results = [];
            let successful_uploads = 0;

            console.log(`Starting upload of ${files.length} files...`);

            for (const file of files) {
                const fileResult = {
                    filename: file.name,
                    size: file.size,
                    s3_key: null,
                    status: 'pending',
                    error: null
                };

                try {
                    console.log(`Processing file: ${file.name}`);

                    // Direct S3 upload using AWS SDK (simplified for Amplify)
                    const s3Result = await uploadSingleFileToS3(file);
                    if (s3Result.success) {
                        fileResult.status = 'success';
                        fileResult.s3_key = s3Result.s3_key;
                        fileResult.s3_location = s3Result.s3_location;
                        successful_uploads++;
                        console.log(`Successfully uploaded to S3: ${file.name}`);
                    } else {
                        throw new Error(s3Result.error);
                    }

                } catch (error) {
                    fileResult.status = 'error';
                    fileResult.error = error.message;
                    console.error(`Upload failed for ${file.name}:`, error);
                }

                results.push(fileResult);
            }

            return {
                message: `Upload completed: ${successful_uploads}/${files.length} files successful`,
                total_files: files.length,
                successful_uploads: successful_uploads,
                failed_uploads: files.length - successful_uploads,
                bucket: API_CONFIG.S3_BUCKET,
                files: results,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Upload error:', error);
            return {
                message: `Upload failed: ${error.message}`,
                total_files: files.length,
                successful_uploads: 0,
                failed_uploads: files.length,
                bucket: API_CONFIG.S3_BUCKET,
                files: files.map(file => ({
                    filename: file.name,
                    size: file.size,
                    s3_key: null,
                    status: 'error',
                    error: error.message
                })),
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Upload a single file to S3 using AWS SDK (fallback method)
     * @param {File} file - File to upload
     * @returns {Promise<Object>} Upload result
     */
    async function uploadSingleFileToS3(file) {
        try {
            // Check if AWS SDK is loaded
            if (typeof AWS === 'undefined') {
                throw new Error('AWS SDK not loaded');
            }

            // Configure AWS SDK with credentials from window.AWS_CONFIG
            AWS.config.update({
                region: window.AWS_CONFIG.region || 'us-east-1',
                accessKeyId: window.AWS_CONFIG.accessKeyId,
                secretAccessKey: window.AWS_CONFIG.secretAccessKey
            });

            const s3 = new AWS.S3();
    const bucketName = API_CONFIG.S3_BUCKET; // UPDATED: Use the configured bucket name
            
            // Test bucket access first (optional - can be removed for production)
            try {
                await s3.headBucket({ Bucket: bucketName }).promise();
                console.log(`✅ S3 bucket '${bucketName}' is accessible`);
            } catch (bucketError) {
                console.warn(`⚠️ Cannot access bucket '${bucketName}': ${bucketError.message}`);
                // For Amplify deployment, CORS errors are common but uploads may still work
                if (bucketError.code === 'NetworkingError' || bucketError.message.includes('CORS')) {
                    console.log('🌐 CORS issue detected - this is normal for browser uploads. Continuing with upload attempt...');
                }
            }
            
            // Generate unique S3 key
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);
            const cleanFilename = file.name.replace(/[^a-zA-Z0-9.-_]/g, '');
            const s3Key = `medical-documents/${timestamp}_${cleanFilename}`;

            // Upload parameters
            const uploadParams = {
                Bucket: bucketName,
                Key: s3Key,
                Body: file,
                ContentType: 'application/pdf',
                ACL: 'private', // Ensure private access
                Metadata: {
                    'original-filename': file.name,
                    'upload-timestamp': new Date().toISOString(),
                    'uploaded-by': 'medical-frontend'
                }
            };

            console.log(`🔄 Uploading ${file.name} to S3...`);

            // Upload to S3 with better error handling
            const result = await new Promise((resolve, reject) => {
                s3.upload(uploadParams, (err, data) => {
                    if (err) {
                        console.error(`❌ S3 upload failed for ${file.name}:`, err);
                        reject(err);
                    } else {
                        console.log(`✅ S3 upload successful for ${file.name}:`, data.Location);
                        resolve(data);
                    }
                });
            });

            return {
                success: true,
                s3_key: s3Key,
                s3_location: result.Location
            };

        } catch (error) {
            console.error(`❌ Upload error for ${file.name}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * For AWS Amplify deployment, we'll use direct S3 upload
     * No need for separate backend service - keep it simple
     * @param {string} filename - Name of the file
     * @returns {Promise<Object>} Always returns fallback to direct upload
     */
    async function getPresignedUrl(filename) {
        // For Amplify deployment, we skip pre-signed URLs and go directly to S3
        console.log(`Using direct S3 upload for Amplify deployment: ${filename}`);
        return {
            success: false,
            error: 'Using direct S3 upload for Amplify',
            fallback: true
        };
    }


    
    /**
     * Show upload progress (simplified for new interface)
     */
    function showUploadProgress() {
        // You can add a loading indicator here if needed
        console.log('Upload started...');
    }
    
    /**
     * Hide upload progress (simplified for new interface)
     */
    function hideUploadProgress() {
        // Clean up any loading indicators
        console.log('Upload completed.');
    }

    // ===== INITIALIZATION =====
    
    // Initialize textarea auto-resize
    autoResizeTextarea();
    
    console.log('AI Clinical Co-pilot Dashboard initialized successfully');
});