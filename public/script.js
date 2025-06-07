// DOM Elements
const accessContainer = document.getElementById('access-container');
const editorContainer = document.getElementById('editor-container');
const accessCode = document.getElementById('accessCode');
const enterBtn = document.getElementById('enterBtn');
const saveBtn = document.getElementById('saveBtn');
const refreshBtn = document.getElementById('refreshBtn');
const saveCloseBtn = document.getElementById('saveCloseBtn');
const closeBtn = document.getElementById('closeBtn');
const noteContent = document.getElementById('noteContent');
const fileList = document.getElementById('fileList');
const padLockToggle = document.getElementById('padLockToggle');
const padLockInput = document.getElementById('padLockInput');
const padLockCode = document.getElementById('padLockCode');

// State
let currentUserId = '';
let currentPadLockCode = '';
let isPadLocked = false;

// Handle pad lock toggle
padLockToggle.addEventListener('change', function(e) {
    if (e.target.checked) {
        padLockInput.style.display = 'block';
    } else {
        padLockInput.style.display = 'none';
        padLockCode.value = '';
        currentPadLockCode = '';
        isPadLocked = false;
    }
});

// Function to create encrypted background text
function generateEncryptedBackground() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    for (let i = 0; i < 1000; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Function to show pad lock screen
function showPadLockScreen() {
    const overlay = document.createElement('div');
    overlay.className = 'locked-overlay';
    
    const encryptedBg = document.createElement('div');
    encryptedBg.className = 'encrypted-background';
    encryptedBg.textContent = generateEncryptedBackground();
    
    const content = document.createElement('div');
    content.className = 'locked-content';
    content.innerHTML = `
        <h2>This Coded Pad™ has been locked.</h2>
        <p>Please enter the second code to fully decrypt it.</p>
        <input type="password" id="unlockPadLockCode" placeholder="Enter pad lock code">
        <div class="button-group">
            <button class="btn btn-primary" onclick="unlockContent()">Unlock</button>
            <button class="btn btn-secondary" onclick="cancelUnlock()">Cancel</button>
        </div>
    `;
    
    overlay.appendChild(encryptedBg);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

// Function to unlock content
function unlockContent() {
    const enteredCode = document.getElementById('unlockPadLockCode').value;
    if (enteredCode === currentPadLockCode) {
        document.querySelector('.locked-overlay').remove();
        isPadLocked = false;
        loadContent();
    } else {
        alert('Invalid pad lock code');
    }
}

// Function to cancel unlock
function cancelUnlock() {
    document.querySelector('.locked-overlay').remove();
    window.location.href = '/';
}

// Load content
async function loadContent() {
    try {
        const response = await fetch(`/api/user/${currentUserId}`);
        if (!response.ok) throw new Error('Failed to fetch user data');
        
        const userData = await response.json();
        if (userData.isPadLocked && !isPadLocked) {
            currentPadLockCode = userData.padLockCode;
            showPadLockScreen();
            return;
        }
        
        const notesResponse = await fetch(`/api/notes/user/${currentUserId}`);
        if (!notesResponse.ok) throw new Error('Failed to fetch notes');
        
        const notes = await notesResponse.json();
        if (notes.length > 0) {
            noteContent.value = notes[0].content;
        }
        
        // Load files if any
        const filesResponse = await fetch(`/api/files/user/${currentUserId}`);
        if (filesResponse.ok) {
            const files = await filesResponse.json();
            displayFiles(files);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error loading content');
    }
}

// Display files
function displayFiles(files) {
    if (!files.length) {
        fileList.innerHTML = '<p>No files uploaded yet</p>';
        return;
    }
    
    fileList.innerHTML = files.map(file => `
        <div class="file-item">
            <span>${file.filename}</span>
            <div class="button-group">
                <button class="btn btn-secondary" onclick="downloadFile('${file._id}')">Download</button>
                <button class="btn btn-secondary" onclick="deleteFile('${file._id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

// Save content
async function saveContent() {
    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUserId,
                content: noteContent.value
            })
        });
        
        if (!response.ok) throw new Error('Failed to save content');
        
        if (padLockToggle.checked) {
            const padLockResponse = await fetch('/api/user/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: currentUserId,
                    isPadLocked: true,
                    padLockCode: padLockCode.value
                })
            });
            
            if (!padLockResponse.ok) throw new Error('Failed to set pad lock');
        }
        
        alert('Saved successfully');
    } catch (error) {
        console.error('Error:', error);
        alert('Error saving content');
    }
}

// Event Listeners
enterBtn.addEventListener('click', () => {
    if (!accessCode.value) {
        alert('Please enter an access code');
        return;
    }
    currentUserId = accessCode.value;
    accessContainer.style.display = 'none';
    editorContainer.style.display = 'block';
    loadContent();
});

saveBtn.addEventListener('click', saveContent);

refreshBtn.addEventListener('click', loadContent);

saveCloseBtn.addEventListener('click', async () => {
    if (padLockToggle.checked && !padLockCode.value) {
        alert('Please enter a pad lock code');
        return;
    }
    
    await saveContent();
    window.location.href = '/';
});

closeBtn.addEventListener('click', () => {
    window.location.href = '/';
}); 