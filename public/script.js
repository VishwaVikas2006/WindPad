let currentPrivateCode = '';
let currentUserId = '';

function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    document.querySelector('.container').insertBefore(messageDiv, document.querySelector('.content-container'));
    setTimeout(() => messageDiv.remove(), 3000);
}

function clearContent() {
    const container = document.getElementById('notesContainer');
    const filesContainer = document.getElementById('filesContainer');
    
    // Immediately hide existing content
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
        container.style.display = 'block';
    }
    
    if (filesContainer) {
        filesContainer.style.display = 'none';
        filesContainer.innerHTML = '';
        filesContainer.style.display = 'block';
    }
    
    // Clear input fields
    const noteInput = document.getElementById('noteInput');
    const noteTitle = document.getElementById('noteTitle');
    
    if (noteInput) {
        noteInput.value = '';
        noteInput.disabled = true;
    }
    
    if (noteTitle) {
        noteTitle.value = '';
        noteTitle.disabled = true;
    }
}

function disablePrivateContent() {
    const noteInput = document.getElementById('noteInput');
    const noteTitle = document.getElementById('noteTitle');
    const fileInput = document.getElementById('fileInput');
    const saveAsPrivate = document.getElementById('saveAsPrivate');
    
    // Disable all inputs
    noteInput.disabled = true;
    noteTitle.disabled = true;
    fileInput.disabled = true;
    if (saveAsPrivate) saveAsPrivate.disabled = true;
    
    // Add blur effect
    noteInput.classList.add('blurred');
    noteTitle.classList.add('blurred');
    
    // Set placeholder text
    noteInput.value = 'Private content - Enter private code to view';
    noteTitle.value = 'Private content';
    
    // Disable buttons
    const buttonContainer = document.querySelector('.button-container');
    if (buttonContainer) {
        buttonContainer.querySelectorAll('button').forEach(button => {
            if (button.textContent !== 'Close') {
                button.disabled = true;
                button.title = 'Enter private code to enable';
            }
        });
    }
}

function enablePrivateContent() {
    const noteInput = document.getElementById('noteInput');
    const noteTitle = document.getElementById('noteTitle');
    const fileInput = document.getElementById('fileInput');
    const saveAsPrivate = document.getElementById('saveAsPrivate');
    
    // Enable all inputs
    noteInput.disabled = false;
    noteTitle.disabled = false;
    fileInput.disabled = false;
    if (saveAsPrivate) saveAsPrivate.disabled = false;
    
    // Remove blur effect
    noteInput.classList.remove('blurred');
    noteTitle.classList.remove('blurred');
    
    // Clear placeholder text if it's the private content message
    if (noteInput.value === 'Private content - Enter private code to view') {
        noteInput.value = '';
    }
    if (noteTitle.value === 'Private content') {
        noteTitle.value = '';
    }
    
    // Enable buttons
    const buttonContainer = document.querySelector('.button-container');
    if (buttonContainer) {
        buttonContainer.querySelectorAll('button').forEach(button => {
            button.disabled = false;
            button.title = '';
        });
    }
}

function displayNotes(notes) {
    const container = document.getElementById('notesContainer');
    container.innerHTML = '';
    
    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'note';
        
        const titleElement = document.createElement('h3');
        titleElement.textContent = note.isLocked ? 'Private Note' : note.title;
        
        const contentElement = document.createElement('p');
        if (note.isLocked) {
            contentElement.classList.add('blurred');
            contentElement.textContent = 'Private content - Enter private code to view';
            
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
}

function displayFiles(files) {
    const container = document.getElementById('filesContainer');
    container.innerHTML = '';
    
    files.forEach(file => {
        const fileElement = document.createElement('div');
        fileElement.className = 'file';
        
        const nameElement = document.createElement('span');
        nameElement.className = 'file-name';
        if (file.isLocked) {
            nameElement.classList.add('blurred');
            nameElement.textContent = 'Private File';
            const lockIcon = document.createElement('span');
            lockIcon.className = 'lock-icon';
            lockIcon.innerHTML = '🔒';
            nameElement.appendChild(lockIcon);
        } else {
            nameElement.textContent = file.filename;
        }
        
        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download';
        downloadButton.onclick = () => downloadFile(file.fileId);
        downloadButton.disabled = file.isLocked;
        downloadButton.title = file.isLocked ? 'Enter private code to download' : '';
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'delete-btn';
        deleteButton.onclick = () => deleteFile(file.fileId);
        deleteButton.disabled = file.isLocked;
        deleteButton.title = file.isLocked ? 'Enter private code to delete' : '';
        
        fileElement.appendChild(nameElement);
        fileElement.appendChild(downloadButton);
        if (file.userId === currentUserId) {
            fileElement.appendChild(deleteButton);
        }
        
        container.appendChild(fileElement);
    });
}

async function fetchUserContent(userId, privateCode = '') {
    try {
        // Clear and disable content immediately
        clearContent();
        disablePrivateContent();
        
        currentPrivateCode = privateCode;
        currentUserId = userId;
        
        const [notesResponse, filesResponse] = await Promise.all([
            fetch(`/api/notes/user/${userId}?privateCode=${privateCode}`),
            fetch(`/api/files/user/${userId}?privateCode=${privateCode}`)
        ]);

        const notesData = await notesResponse.json();
        const filesData = await filesResponse.json();

        if (!notesResponse.ok) {
            throw new Error(notesData.message || 'Failed to fetch notes');
        }

        if (!filesResponse.ok) {
            throw new Error(filesData.message || 'Failed to fetch files');
        }

        const notes = notesData.data || [];
        const files = filesData || [];

        // Only enable content if we have the correct private code
        const hasPrivateContent = notes.some(note => note.isPrivate) || files.some(file => file.isPrivate);
        if (!hasPrivateContent || (hasPrivateContent && privateCode)) {
            enablePrivateContent();
        }

        displayNotes(notes);
        displayFiles(files);
        
        // Show content container and hide login container
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('contentContainer').style.display = 'block';
    } catch (error) {
        console.error('Error fetching content:', error);
        showMessage(error.message || 'Error fetching content', 'error');
        
        // Show error state in containers
        const notesContainer = document.getElementById('notesContainer');
        const filesContainer = document.getElementById('filesContainer');
        
        if (notesContainer) {
            notesContainer.innerHTML = `
                <div class="error-message">
                    <p>⚠️ Failed to load notes</p>
                    <button onclick="retryFetch()">Retry</button>
                </div>
            `;
        }
        
        if (filesContainer) {
            filesContainer.innerHTML = `
                <div class="error-message">
                    <p>⚠️ Failed to load files</p>
                    <button onclick="retryFetch()">Retry</button>
                </div>
            `;
        }
    }
}

function retryFetch() {
    if (currentUserId) {
        fetchUserContent(currentUserId, currentPrivateCode);
    }
}

async function downloadFile(fileId) {
    try {
        const response = await fetch(`/api/download/${fileId}?privateCode=${currentPrivateCode}`);
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

async function deleteFile(fileId) {
    try {
        const response = await fetch(`/api/delete/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUserId,
                privateCode: currentPrivateCode
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

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Access button click handler
    document.getElementById('accessButton').addEventListener('click', async () => {
        const userId = document.getElementById('userInput').value.trim();
        const privateCodeInput = document.getElementById('privateCodeInput').value.trim();
        
        if (!userId) {
            showMessage('Please enter a user ID', 'error');
            return;
        }
        
        await fetchUserContent(userId, privateCodeInput);
    });
    
    // Save button click handler
    document.querySelector('.save-btn').addEventListener('click', () => {
        document.getElementById('noteForm').dispatchEvent(new Event('submit'));
    });
    
    // Refresh button click handler
    document.querySelector('.refresh-btn').addEventListener('click', () => {
        fetchUserContent(currentUserId, currentPrivateCode);
    });
    
    // Save as Private button click handler
    document.querySelector('.private-btn').addEventListener('click', () => {
        document.getElementById('saveNoteAsPrivate').checked = true;
        document.getElementById('noteForm').dispatchEvent(new Event('submit'));
    });
    
    // Save & Close button click handler
    document.querySelector('.save-close-btn').addEventListener('click', async () => {
        await document.getElementById('noteForm').dispatchEvent(new Event('submit'));
        document.getElementById('loginContainer').style.display = 'block';
        document.getElementById('contentContainer').style.display = 'none';
        clearContent();
    });
    
    // Close button click handler
    document.querySelector('.close-btn').addEventListener('click', () => {
        document.getElementById('loginContainer').style.display = 'block';
        document.getElementById('contentContainer').style.display = 'none';
        clearContent();
    });
    
    // File upload handler
    document.getElementById('fileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 10 * 1024 * 1024) {
            showMessage('File size must be less than 10MB', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
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
                throw new Error('Upload failed');
            }
            
            showMessage('File uploaded successfully!', 'success');
            setTimeout(() => {
                fetchUserContent(currentUserId, currentPrivateCode);
            }, 1000);
        } catch (error) {
            console.error('Upload error:', error);
            showMessage('Error uploading file', 'error');
        }
    });
});

// Note form submit handler
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
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Failed to save note');
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
        showMessage(error.message || 'Error saving note', 'error');
    }
};

// Add styles for blurred content and lock icon
const style = document.createElement('style');
style.textContent = `
    .blurred {
        filter: blur(5px);
        user-select: none;
    }
    .lock-icon {
        margin-left: 8px;
        font-size: 16px;
    }
    .file-name {
        display: inline-block;
        margin-right: 10px;
    }
    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;
document.head.appendChild(style);

// Add button container styles and reposition buttons
const buttonContainerStyle = document.createElement('style');
buttonContainerStyle.textContent = `
    .button-container {
        display: flex;
        gap: 10px;
        margin: 10px 0;
        justify-content: center;
        align-items: center;
        padding: 10px;
        background: #f5f5f5;
        border-radius: 5px;
    }
    
    .button-container button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s ease;
    }
    
    .button-container button:hover {
        opacity: 0.9;
    }
    
    .button-container .save-btn {
        background: #e0e0e0;
    }
    
    .button-container .refresh-btn {
        background: #e0e0e0;
    }
    
    .button-container .private-btn {
        background: #e0e0e0;
    }
    
    .button-container .save-close-btn {
        background: #1a73e8;
        color: white;
    }
    
    .button-container .close-btn {
        background: #e0e0e0;
    }
    
    .blurred {
        filter: blur(5px);
        user-select: none;
        pointer-events: none;
    }
    
    .lock-icon {
        margin-left: 8px;
        font-size: 16px;
    }
    
    .file-name {
        display: inline-block;
        margin-right: 10px;
    }
    
    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;
document.head.appendChild(buttonContainerStyle);

// Create and insert button container
function createButtonContainer() {
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
    saveCloseBtn.onclick = async () => {
        await document.getElementById('noteForm').dispatchEvent(new Event('submit'));
        clearContent();
    };
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = 'close-btn';
    closeBtn.onclick = clearContent;
    
    buttonContainer.append(saveBtn, refreshBtn, privateBtn, saveCloseBtn, closeBtn);
    
    // Insert after the note input but before the file upload section
    const fileSection = document.querySelector('#fileForm');
    noteForm.insertBefore(buttonContainer, noteForm.querySelector('button[type="submit"]'));
    noteForm.querySelector('button[type="submit"]').style.display = 'none';
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', createButtonContainer);

// Update styles for better performance and immediate hiding
const updatedStyles = document.createElement('style');
updatedStyles.textContent = `
    .blurred {
        filter: blur(5px);
        user-select: none;
        pointer-events: none;
        cursor: not-allowed;
        visibility: visible;
        opacity: 1;
        transition: none;
    }
    
    .note {
        opacity: 1;
        transition: none;
    }
    
    .note h3, .note p {
        transition: none;
    }
    
    .private-content {
        display: none;
    }
    
    .private-placeholder {
        text-align: center;
        padding: 20px;
        background: #f5f5f5;
        border-radius: 5px;
        margin: 10px 0;
    }
    
    .private-placeholder .lock-icon {
        font-size: 24px;
        margin-bottom: 10px;
        display: block;
    }
`;
document.head.appendChild(updatedStyles);

// Add error message styles
const errorStyles = document.createElement('style');
errorStyles.textContent = `
    .error-message {
        text-align: center;
        padding: 20px;
        background: #fff3f3;
        border: 1px solid #ffcdd2;
        border-radius: 5px;
        margin: 10px 0;
    }
    
    .error-message p {
        color: #d32f2f;
        margin: 0 0 10px 0;
    }
    
    .error-message button {
        background: #d32f2f;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    }
    
    .error-message button:hover {
        background: #b71c1c;
    }
`;
document.head.appendChild(errorStyles); 