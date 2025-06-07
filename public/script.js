let currentPrivateCode = '';
let currentUserId = '';

// DOM Elements
const accessContainer = document.getElementById('access-container');
const editorContainer = document.getElementById('editor-container');
const accessCode = document.getElementById('access-code');
const openBtn = document.getElementById('open-btn');
const saveBtn = document.getElementById('save-btn');
const refreshBtn = document.getElementById('refresh-btn');
const saveCloseBtn = document.getElementById('save-close-btn');
const closeBtn = document.getElementById('close-btn');
const noteContent = document.getElementById('note-content');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const fileList = document.getElementById('file-list');
const statusMessage = document.getElementById('status-message');
const padLockToggle = document.getElementById('padLockToggle');
const padLockInput = document.getElementById('padLockInput');
const padLockCode = document.getElementById('padLockCode');
const lockedOverlay = document.createElement('div');

// State
let isPadLocked = false;
let currentPadLockCode = '';

// Create locked overlay
lockedOverlay.className = 'locked-overlay';
lockedOverlay.innerHTML = `
    <div class="locked-content">
        <h2>This Coded Pad™ has been locked.</h2>
        <p>Please enter the second code to fully decrypt it.</p>
        <input type="password" id="unlockCode" placeholder="Enter pad lock code" class="form-control">
        <div class="button-group" style="margin-top: 15px;">
            <button class="btn" onclick="unlockContent()">Unlock</button>
            <button class="btn btn-secondary" onclick="cancelUnlock()">Cancel</button>
        </div>
    </div>
    <div class="encrypted-background"></div>
`;

function clearContent() {
    document.getElementById('notesContainer').innerHTML = '';
    document.getElementById('filesContainer').innerHTML = '';
    document.getElementById('noteInput').value = '';
    document.getElementById('noteTitle').value = '';
    document.getElementById('saveNoteAsPrivate').checked = false;
    document.getElementById('saveAsPrivate').checked = false;
}

function setTextBoxState(isPrivate, hasPrivateCode) {
    const noteInput = document.getElementById('noteInput');
    const noteTitle = document.getElementById('noteTitle');
    
    if (isPrivate && !hasPrivateCode) {
        noteInput.classList.add('blurred');
        noteTitle.classList.add('blurred');
        noteInput.readOnly = true;
        noteTitle.readOnly = true;
        noteInput.style.pointerEvents = 'none';
        noteTitle.style.pointerEvents = 'none';
    } else {
        noteInput.classList.remove('blurred');
        noteTitle.classList.remove('blurred');
        noteInput.readOnly = false;
        noteTitle.readOnly = false;
        noteInput.style.pointerEvents = 'auto';
        noteTitle.style.pointerEvents = 'auto';
    }
}

function displayNotes(notes, hasPrivateCode = false) {
    const container = document.getElementById('notesContainer');
    container.innerHTML = '';
    let hasPrivateNotes = false;
    
    notes.forEach(note => {
        if (note.isPrivate) hasPrivateNotes = true;
        const noteElement = document.createElement('div');
        noteElement.className = 'note';
        
        const titleElement = document.createElement('h3');
        titleElement.textContent = note.title;
        
        const contentElement = document.createElement('p');
        if (note.isLocked) {
            contentElement.classList.add('blurred');
            contentElement.textContent = 'Private content';
            contentElement.style.pointerEvents = 'none';
            
            const lockIcon = document.createElement('span');
            lockIcon.className = 'lock-icon';
            lockIcon.innerHTML = '🔒';
            titleElement.appendChild(lockIcon);
        } else {
            contentElement.textContent = note.content;
        }
        
        const dateElement = document.createElement('small');
        dateElement.textContent = new Date(note.createdAt).toLocaleString();
        
        noteElement.appendChild(titleElement);
        noteElement.appendChild(contentElement);
        noteElement.appendChild(dateElement);
        container.appendChild(noteElement);
    });

    setTextBoxState(hasPrivateNotes, hasPrivateCode);
}

function displayFiles(files, hasPrivateCode = false) {
    const container = document.getElementById('filesContainer');
    container.innerHTML = '';
    
    files.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.className = 'file';
        
        const nameElement = document.createElement('span');
        nameElement.className = 'file-name';
        if (file.isLocked) {
            nameElement.classList.add('blurred');
            nameElement.style.pointerEvents = 'none';
            const lockIcon = document.createElement('span');
            lockIcon.className = 'lock-icon';
            lockIcon.innerHTML = '🔒';
            nameElement.appendChild(lockIcon);
        }
        nameElement.textContent = file.filename;
        
        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download';
        downloadButton.onclick = () => downloadFile(file.fileId, file.privateCode);
        if (file.isLocked) {
            downloadButton.disabled = true;
            downloadButton.title = 'Enter private code to download';
        }
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'delete-btn';
        deleteButton.onclick = () => deleteFile(file.fileId, file.privateCode);
        if (file.isLocked) {
            deleteButton.disabled = true;
            deleteButton.title = 'Enter private code to delete';
        }
        
        fileElement.appendChild(nameElement);
        fileElement.appendChild(downloadButton);
        if (file.userId === currentUserId) {
            fileElement.appendChild(deleteButton);
        }
        
        container.appendChild(fileElement);
    });
}

async function downloadFile(fileId, privateCode = '') {
    try {
        const response = await fetch(`/api/download/${fileId}?privateCode=${privateCode || currentPrivateCode}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } else {
            const error = await response.json();
            showMessage(error.message || 'Error downloading file', 'error');
        }
    } catch (error) {
        console.error('Download error:', error);
        showMessage('Error downloading file', 'error');
    }
}

async function deleteFile(fileId, privateCode = '') {
    try {
        const response = await fetch(`/api/delete/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUserId,
                privateCode: privateCode || currentPrivateCode
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete file');
        }

        await fetchUserContent(currentUserId, currentPrivateCode);
        showMessage('File deleted successfully', 'success');
    } catch (error) {
        console.error('Delete error:', error);
        showMessage(error.message || 'Error deleting file', 'error');
    }
}

async function fetchUserContent(userId, privateCode = '') {
    try {
        clearContent();
        currentPrivateCode = privateCode;
        currentUserId = userId;
        
        const [notesResponse, filesResponse] = await Promise.all([
            fetch(`/api/notes/user/${userId}?privateCode=${privateCode}`),
            fetch(`/api/files/user/${userId}?privateCode=${privateCode}`)
        ]);

        if (!notesResponse.ok || !filesResponse.ok) {
            throw new Error('Failed to fetch content');
        }

        const [notes, files] = await Promise.all([
            notesResponse.json(),
            filesResponse.json()
        ]);

        displayNotes(notes, !!privateCode);
        displayFiles(files, !!privateCode);
    } catch (error) {
        console.error('Error fetching content:', error);
        showMessage('Error fetching content', 'error');
    }
}

// Update file upload to handle private files
document.getElementById('fileForm').onsubmit = async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    formData.append('userId', currentUserId);
    
    const isPrivate = document.getElementById('saveAsPrivate').checked;
    if (isPrivate) {
        const privateCode = prompt('Enter a private code for this file:');
        if (!privateCode) return;
        formData.append('isPrivate', 'true');
        formData.append('privateCode', privateCode);
    }
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Upload failed');
        }
        
        showMessage('File uploaded successfully!', 'success');
        setTimeout(() => {
            fetchUserContent(currentUserId, currentPrivateCode);
        }, 1000);
    } catch (error) {
        console.error('Upload error:', error);
        showMessage(error.message || 'Error uploading file', 'error');
    }
};

// Update note saving to handle private notes
document.getElementById('noteForm').onsubmit = async function(e) {
    e.preventDefault();
    const title = document.getElementById('noteTitle').value;
    const content = document.getElementById('noteInput').value;
    
    if (!title || !content) {
        showMessage('Please enter both title and content', 'error');
        return;
    }
    
    const isPrivate = document.getElementById('saveNoteAsPrivate').checked;
    let privateCode = '';
    
    if (isPrivate) {
        privateCode = prompt('Enter a private code for this note:');
        if (!privateCode) return;
    }
    
    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUserId,
                title,
                content,
                isPrivate,
                privateCode
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save note');
        }
        
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteInput').value = '';
        document.getElementById('saveNoteAsPrivate').checked = false;
        
        showMessage('Note saved successfully!', 'success');
        setTimeout(() => {
            fetchUserContent(currentUserId, currentPrivateCode);
        }, 1000);
    } catch (error) {
        console.error('Error saving note:', error);
        showMessage('Error saving note', 'error');
    }
};

// Update the access button click handler
document.getElementById('accessButton').addEventListener('click', async () => {
    const userId = document.getElementById('userInput').value.trim();
    const privateCodeInput = document.getElementById('privateCodeInput').value.trim();
    
    if (!userId) {
        showMessage('Please enter a user ID', 'error');
        return;
    }
    
    clearContent();
    await fetchUserContent(userId, privateCodeInput);
});

// Add styles for blurred content and interaction prevention
const style = document.createElement('style');
style.textContent = `
    .blurred {
        filter: blur(5px);
        user-select: none;
        pointer-events: none !important;
    }
    .lock-icon {
        margin-left: 8px;
        font-size: 16px;
    }
    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;
document.head.appendChild(style);

// Reorganize the buttons
function setupButtonLayout() {
    const noteForm = document.getElementById('noteForm');
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'save-btn';
    saveBtn.onclick = () => document.getElementById('noteForm').dispatchEvent(new Event('submit'));
    
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh';
    refreshBtn.className = 'refresh-btn';
    refreshBtn.onclick = () => fetchUserContent(currentUserId, currentPrivateCode);
    
    const privateBtn = document.createElement('button');
    privateBtn.textContent = 'Save as Private';
    privateBtn.className = 'private-btn';
    privateBtn.onclick = () => {
        document.getElementById('saveNoteAsPrivate').checked = true;
        document.getElementById('noteForm').dispatchEvent(new Event('submit'));
    };
    
    const saveCloseBtn = document.createElement('button');
    saveCloseBtn.textContent = 'Save & Close';
    saveCloseBtn.className = 'save-close-btn';
    saveCloseBtn.onclick = () => {
        document.getElementById('noteForm').dispatchEvent(new Event('submit'));
        setTimeout(() => document.getElementById('closeBtn').click(), 1000);
    };
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = 'close-btn';
    closeBtn.id = 'closeBtn';
    closeBtn.onclick = () => {
        clearContent();
        document.getElementById('userInput').value = '';
        document.getElementById('privateCodeInput').value = '';
    };
    
    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(refreshBtn);
    buttonContainer.appendChild(privateBtn);
    buttonContainer.appendChild(saveCloseBtn);
    buttonContainer.appendChild(closeBtn);
    
    // Insert the button container after the note input
    const noteInput = document.getElementById('noteInput');
    noteInput.parentNode.insertBefore(buttonContainer, noteInput.nextSibling);
}

// Call setupButtonLayout after DOM is loaded
document.addEventListener('DOMContentLoaded', setupButtonLayout);

// Show status message
function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = isError ? 'error' : 'success';
    statusMessage.style.display = 'block';
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 3000);
}

// Handle file upload button click
uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

// Handle file selection
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        showStatus('File size must be less than 10MB', true);
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', accessCode.value);
    formData.append('isPadLocked', isPadLocked ? 'true' : 'false');
    formData.append('padLockCode', currentPadLockCode);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            showStatus('File uploaded successfully');
            loadFiles();
            fileInput.value = ''; // Clear the file input
        } else {
            const error = await response.json();
            showStatus(error.error || 'Failed to upload file', true);
        }
    } catch (error) {
        showStatus('Error uploading file', true);
    }
});

// Load files for user
async function loadFiles() {
    try {
        const response = await fetch(`/api/files/user/${accessCode.value}?padLockCode=${currentPadLockCode || ''}`);
        const files = await response.json();

        fileList.innerHTML = '';
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span>${file.name}</span>
                <div class="button-group">
                    <button class="btn btn-secondary" onclick="downloadFile('${file._id}')">Download</button>
                    <button class="btn btn-secondary" onclick="deleteFile('${file._id}')">Delete</button>
                </div>
            `;
            fileList.appendChild(fileItem);
        });
    } catch (error) {
        showStatus('Error loading files', true);
    }
}

// Load note content
async function loadNote() {
    try {
        const response = await fetch(`/api/notes/user/${accessCode.value}?padLockCode=${currentPadLockCode || ''}`);
        const notes = await response.json();
        
        if (notes && notes.content) {
            noteContent.value = notes.content;
        }
    } catch (error) {
        showStatus('Error loading notes', true);
    }
}

// Show pad lock input
padLockToggle.addEventListener('change', () => {
    if (padLockToggle.checked) {
        padLockInput.style.display = 'block';
    } else {
        padLockInput.style.display = 'none';
        padLockCode.value = '';
        currentPadLockCode = '';
        isPadLocked = false;
    }
});

// Handle pad lock code input
padLockCode.addEventListener('input', () => {
    const code = padLockCode.value;
    if (code) {
        currentPadLockCode = code;
        isPadLocked = true;
    } else {
        currentPadLockCode = '';
        isPadLocked = false;
    }
});

// Unlock content
function unlockContent() {
    const unlockCode = document.getElementById('unlockCode');
    if (unlockCode.value === currentPadLockCode) {
        document.body.removeChild(lockedOverlay);
        accessContainer.style.display = 'none';
        editorContainer.style.display = 'block';
        loadNote();
        loadFiles();
        showStatus('Content unlocked');
    } else {
        showStatus('Invalid pad lock code', true);
    }
}

// Cancel unlock
function cancelUnlock() {
    document.body.removeChild(lockedOverlay);
    accessContainer.style.display = 'block';
    editorContainer.style.display = 'none';
    noteContent.value = '';
    fileList.innerHTML = '';
    padLockToggle.checked = false;
    padLockInput.style.display = 'none';
    padLockCode.value = '';
}

// Open editor
openBtn.addEventListener('click', async () => {
    if (!accessCode.value) {
        showStatus('Please enter an access code', true);
        return;
    }

    try {
        const response = await fetch(`/api/notes/user/${accessCode.value}`);
        const note = await response.json();

        if (note && note.isPadLocked) {
            document.body.appendChild(lockedOverlay);
            return;
        }

        accessContainer.style.display = 'none';
        editorContainer.style.display = 'block';
        await loadNote();
        await loadFiles();
    } catch (error) {
        showStatus('Error accessing content', true);
    }
});

// Save note
saveBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/notes/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: accessCode.value,
                content: noteContent.value,
                isPadLocked: isPadLocked,
                padLockCode: currentPadLockCode
            })
        });

        if (response.ok) {
            showStatus('Saved successfully');
        } else {
            showStatus('Failed to save', true);
        }
    } catch (error) {
        showStatus('Error saving note', true);
    }
});

// Refresh content
refreshBtn.addEventListener('click', async () => {
    await loadNote();
    await loadFiles();
    showStatus('Content refreshed');
});

// Save and close
saveCloseBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/notes/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: accessCode.value,
                content: noteContent.value,
                isPadLocked: isPadLocked,
                padLockCode: currentPadLockCode
            })
        });

        if (response.ok) {
            showStatus('Saved successfully');
            setTimeout(() => {
                isPadLocked = false;
                currentPadLockCode = '';
                accessContainer.style.display = 'block';
                editorContainer.style.display = 'none';
                noteContent.value = '';
                fileList.innerHTML = '';
                padLockToggle.checked = false;
                padLockInput.style.display = 'none';
                padLockCode.value = '';
            }, 1000);
        } else {
            showStatus('Failed to save', true);
        }
    } catch (error) {
        showStatus('Error saving note', true);
    }
});

// Close editor
closeBtn.addEventListener('click', () => {
    isPadLocked = false;
    currentPadLockCode = '';
    accessContainer.style.display = 'block';
    editorContainer.style.display = 'none';
    noteContent.value = '';
    fileList.innerHTML = '';
    padLockToggle.checked = false;
    padLockInput.style.display = 'none';
    padLockCode.value = '';
}); 