let currentPrivateCode = '';

async function fetchUserContent(userId, privateCode = '') {
    try {
        currentPrivateCode = privateCode;
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

// Update the access button click handler
document.getElementById('accessButton').addEventListener('click', async () => {
    const userId = document.getElementById('userInput').value.trim();
    const privateCodeInput = document.getElementById('privateCodeInput').value.trim();
    
    if (!userId) {
        showMessage('Please enter a user ID', 'error');
        return;
    }

    currentUserId = userId;
    await fetchUserContent(userId, privateCodeInput);
}); 