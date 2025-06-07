// DOM Elements
const homePage = document.getElementById('homePage');
const filePage = document.getElementById('filePage');
const accessCodeInput = document.getElementById('userIdInput');
const loginButton = document.getElementById('loginButton');
const accessCodeDisplay = document.getElementById('userId');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const messageContainer = document.getElementById('messageContainer');

// New Text Input Elements
const textInput = document.getElementById('textInput');
const saveTextButton = document.getElementById('saveTextButton');

// API Endpoints
const API_BASE_URL = window.location.origin;
const ENDPOINTS = {
    UPLOAD: `${API_BASE_URL}/api/upload`,
    FILES: `${API_BASE_URL}/api/files/user`,
    DOWNLOAD: `${API_BASE_URL}/api/download`,
    DELETE: `${API_BASE_URL}/api/delete`,
    SAVE: `${API_BASE_URL}/api/save`,
    SAVE_NOTE: `${API_BASE_URL}/api/note`,
    NOTES_BY_USER: `${API_BASE_URL}/api/notes/user`,
    DELETE_NOTE: `${API_BASE_URL}/api/note`
};

// Current access code state
let currentAccessCode = '';

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check for stored access code
    const storedAccessCode = localStorage.getItem('accessCode');
    if (storedAccessCode) {
        loginWithCode(storedAccessCode);
    }

    // Setup event listeners
    loginButton.addEventListener('click', handleLogin);
    accessCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // File upload listeners
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('drop', handleDrop);

    // New: Text input listener
    saveTextButton.addEventListener('click', saveText);
});

// Login handling
async function handleLogin() {
    const accessCode = accessCodeInput.value.trim();
    if (accessCode) {
        loginWithCode(accessCode);
    } else {
        showMessage('Please enter an access code', 'error');
    }
}

function loginWithCode(accessCode) {
    currentAccessCode = accessCode;
    localStorage.setItem('accessCode', accessCode);
    accessCodeDisplay.textContent = `Access Code: ${accessCode}`;
    homePage.classList.add('hidden');
    filePage.classList.remove('hidden');
    loadFiles();
}

function logout() {
    currentAccessCode = '';
    localStorage.removeItem('accessCode');
    homePage.classList.remove('hidden');
    filePage.classList.add('hidden');
    accessCodeInput.value = '';
    fileList.innerHTML = '';
}

// File handling
async function loadFiles() {
    try {
        if (!currentAccessCode) {
            showMessage('Please enter an access code first', 'error');
            return;
        }

        // Fetch files
        const filesResponse = await fetch(`${ENDPOINTS.FILES}/${currentAccessCode}`);
        const filesData = await filesResponse.json();
        
        if (!filesResponse.ok) {
            throw new Error(filesData.message || 'Failed to load files');
        }

        // Fetch notes
        const notesResponse = await fetch(`${ENDPOINTS.NOTES_BY_USER}/${currentAccessCode}`);
        const notesData = await notesResponse.json();

        if (!notesResponse.ok) {
            throw new Error(notesData.message || 'Failed to load notes');
        }
        
        // Combine and display both
        const allItems = [...filesData.map(f => ({ ...f, type: 'file' })), ...notesData.map(n => ({ ...n, type: 'note' }))];
        displayFiles(allItems);

    } catch (error) {
        showMessage('Error loading content: ' + error.message, 'error');
        console.error('Error:', error);
    }
}

function displayFiles(items) {
    if (!items || !items.length) {
        fileList.innerHTML = `
            <div class="empty-state">
                <span class="icon">📂</span>
                <p>No files or notes uploaded yet</p>
            </div>
        `;
        return;
    }

    fileList.innerHTML = items.map(item => {
        if (item.type === 'file') {
            return `
                <div class="file-item">
                    <div class="file-info">
                        <span class="filename">${item.filename}</span>
                        <span class="file-size">${formatFileSize(item.size)}</span>
                    </div>
                    <div class="file-actions">
                        <button onclick="downloadFile('${item.fileId}')" class="secondary-button">Download</button>
                        <button onclick="deleteFile('${item.fileId}')" class="secondary-button delete">Delete</button>
                    </div>
                </div>
            `;
        } else if (item.type === 'note') {
            return `
                <div class="file-item note-item">
                    <div class="file-info">
                        <span class="filename">Note: ${item.title || 'Untitled Note'}</span>
                        <span class="file-size">${item.content.length} characters</span>
                    </div>
                    <div class="file-actions">
                        <button onclick="viewNote('${item._id}')" class="secondary-button">View</button>
                        <button onclick="deleteNote('${item._id}')" class="secondary-button delete">Delete</button>
                    </div>
                </div>
            `;
        }
        return ''; // Should not happen
    }).join('');
}

// File upload handling
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.style.borderColor = 'var(--primary-color)';
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.style.borderColor = 'var(--border-color)';
    
    const files = e.dataTransfer.files;
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

function isValidFile(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];
    
    if (file.size > maxSize) {
        throw new Error(`File ${file.name} is too large. Maximum size is 10MB`);
    }
    
    if (!allowedTypes.includes(file.type)) {
        throw new Error(`File ${file.name} has invalid type. Only images, PDFs, DOCs, and TXT files are allowed`);
    }
    
    return true;
}

async function handleFiles(files) {
    const uploadPromises = [];
    const errors = [];

    // Show initial upload status
    showMessage('Starting file upload...', 'info');
    
    // Add loading class to dropzone
    dropZone.classList.add('uploading');

    for (const file of files) {
        try {
            isValidFile(file);
            uploadPromises.push(uploadFile(file));
        } catch (error) {
            errors.push(error.message);
        }
    }

    if (errors.length > 0) {
        showMessage(errors.join('\n'), 'error');
    }

    if (uploadPromises.length > 0) {
        try {
            await Promise.all(uploadPromises);
            showMessage(`Successfully uploaded ${uploadPromises.length} file(s)`, 'success');
            loadFiles();
        } catch (error) {
            showMessage('Error uploading files: ' + error.message, 'error');
            console.error('Upload error:', error);
        }
    }
    
    // Remove loading class from dropzone
    dropZone.classList.remove('uploading');
    fileInput.value = '';
}

async function uploadFile(file) {
    if (!currentAccessCode) {
        throw new Error('Please enter an access code first');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', currentAccessCode);

    try {
        showMessage(`Uploading ${file.name}...`, 'info');
        
        const response = await fetch(ENDPOINTS.UPLOAD, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || `Failed to upload ${file.name}`);
        }

        showMessage(`Successfully uploaded ${file.name}`, 'success');
        return data.file;
    } catch (error) {
        console.error('Upload error details:', error);
        throw new Error(`Failed to upload ${file.name}: ${error.message}`);
    }
}

// File actions
async function saveFile(fileId) {
    try {
        const response = await fetch(`${ENDPOINTS.SAVE}/${fileId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ accessCode: currentAccessCode })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Save failed');
        }

        showMessage('File saved successfully', 'success');
    } catch (error) {
        showMessage('Failed to save file: ' + error.message, 'error');
        console.error('Save error:', error);
    }
}

async function downloadFile(fileId) {
    try {
        const response = await fetch(`${ENDPOINTS.DOWNLOAD}/${fileId}?accessCode=${currentAccessCode}`);
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('Content-Disposition').split('filename=')[1].replace(/['"]/g, '');
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        showMessage('Failed to download file: ' + error.message, 'error');
        console.error('Download error:', error);
    }
}

async function deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
        const response = await fetch(`${ENDPOINTS.DELETE}/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ accessCode: currentAccessCode })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Delete failed');
        }
        
        showMessage('File deleted successfully', 'success');
        loadFiles();
    } catch (error) {
        showMessage('Failed to delete file: ' + error.message, 'error');
        console.error('Delete error:', error);
    }
}

// New: Text note handling
async function saveText() {
    const textContent = textInput.value.trim();
    if (!textContent) {
        showMessage('Please type some text to save', 'error');
        return;
    }
    if (!currentAccessCode) {
        showMessage('Please enter an access code first', 'error');
        return;
    }

    try {
        showMessage('Saving note...', 'info');
        const response = await fetch(ENDPOINTS.SAVE_NOTE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentAccessCode,
                content: textContent
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to save note');
        }

        showMessage('Note saved successfully', 'success');
        textInput.value = ''; // Clear the textarea
        loadFiles(); // Reload all items
    } catch (error) {
        console.error('Save note error details:', error);
        showMessage('Error saving note: ' + error.message, 'error');
    }
}

async function viewNote(noteId) {
    // For now, just show in alert. Later, we can add a modal.
    try {
        const response = await fetch(`${ENDPOINTS.SAVE_NOTE}/${noteId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch note');
        }
        alert(`Note Content:\n\n${data.content}`);
    } catch (error) {
        console.error('View note error:', error);
        showMessage('Error viewing note: ' + error.message, 'error');
    }
}

async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) {
        return;
    }

    try {
        showMessage('Deleting note...', 'info');
        const response = await fetch(`${ENDPOINTS.DELETE_NOTE}/${noteId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: currentAccessCode }) // Send userId for authorization
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to delete note');
        }

        showMessage('Note deleted successfully', 'success');
        loadFiles(); // Reload the list
    } catch (error) {
        console.error('Delete note error:', error);
        showMessage('Error deleting note: ' + error.message, 'error');
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showMessage(message, type) {
    messageContainer.textContent = message;
    messageContainer.className = `message ${type}`;
    messageContainer.style.opacity = '1';
    
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            messageContainer.style.opacity = '0';
        }, 3000);
    } else {
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.className = 'close-message';
        closeButton.onclick = () => {
            messageContainer.style.opacity = '0';
        };
        messageContainer.appendChild(closeButton);
    }
} 