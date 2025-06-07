let currentPrivateCode = '';
let currentUserId = '';

function clearContent() {
    document.getElementById('notesContainer').innerHTML = '';
    document.getElementById('filesContainer').innerHTML = '';
    document.getElementById('noteInput').value = '';
    document.getElementById('noteTitle').value = '';
}

function displayNotes(notes) {
    const container = document.getElementById('notesContainer');
    container.innerHTML = '';
    
    notes.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = 'note';
        
        const titleElement = document.createElement('h3');
        titleElement.textContent = note.title;
        
        const contentElement = document.createElement('p');
        if (note.isLocked) {
            contentElement.classList.add('blurred');
            contentElement.textContent = note.content || 'Private content';
            
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
            const lockIcon = document.createElement('span');
            lockIcon.className = 'lock-icon';
            lockIcon.innerHTML = '🔒';
            nameElement.appendChild(lockIcon);
        }
        nameElement.textContent = file.filename;
        
        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download';
        downloadButton.onclick = () => downloadFile(file.fileId);
        if (file.isLocked) {
            downloadButton.disabled = true;
            downloadButton.title = 'Enter private code to download';
        }
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'delete-btn';
        deleteButton.onclick = () => deleteFile(file.fileId);
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

        displayNotes(notes);
        displayFiles(files);
    } catch (error) {
        console.error('Error fetching content:', error);
        showMessage('Error fetching content', 'error');
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