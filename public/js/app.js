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

// API Endpoints
const API_BASE_URL = window.location.origin;
const ENDPOINTS = {
    UPLOAD: `${API_BASE_URL}/api/upload`,
    FILES: `${API_BASE_URL}/api/files/user`,
    DOWNLOAD: `${API_BASE_URL}/api/download`,
    DELETE: `${API_BASE_URL}/api/delete`,
    SAVE: `${API_BASE_URL}/api/save`
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

        const response = await fetch(`${ENDPOINTS.FILES}/${currentAccessCode}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to load files');
        }
        
        displayFiles(data);
    } catch (error) {
        showMessage('Error loading files: ' + error.message, 'error');
        console.error('Error:', error);
    }
}

function displayFiles(files) {
    if (!files || !files.length) {
        fileList.innerHTML = `
            <div class="empty-state">
                <span class="icon">📂</span>
                <p>No files uploaded yet</p>
            </div>
        `;
        return;
    }

    fileList.innerHTML = files.map(file => `
        <div class="file-item">
            <div class="file-info">
                <span class="filename">${file.filename}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
            </div>
            <div class="file-actions">
                <button onclick="downloadFile('${file.fileId}')" class="secondary-button">Download</button>
                <button onclick="deleteFile('${file.fileId}')" class="secondary-button delete">Delete</button>
            </div>
        </div>
    `).join('');
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