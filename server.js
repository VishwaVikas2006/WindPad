app.post('/api/notes', async (req, res) => {
    try {
        const { userId, title, content, isPadLocked, padLockCode } = req.body;
        
        if (!userId || !title || !content) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        const note = {
            userId,
            title,
            content,
            isPadLocked: !!isPadLocked,
            padLockCode: isPadLocked ? padLockCode : null,
            timestamp: new Date()
        };
        
        await db.collection('notes').insertOne(note);
        res.json({ message: 'Note saved successfully' });
    } catch (error) {
        console.error('Error saving note:', error);
        res.status(500).json({ message: 'Error saving note' });
    }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const { userId, isPadLocked, padLockCode } = req.body;
        const file = req.file;
        
        if (!userId || !file) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        const fileDoc = {
            userId,
            filename: file.filename,
            originalName: file.originalname,
            isPadLocked: isPadLocked === 'true',
            padLockCode: isPadLocked === 'true' ? padLockCode : null,
            timestamp: new Date()
        };
        
        await db.collection('files').insertOne(fileDoc);
        res.json({ message: 'File uploaded successfully' });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Error uploading file' });
    }
});

app.get('/api/content/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const notes = await db.collection('notes')
            .find({ userId })
            .sort({ timestamp: -1 })
            .toArray();
            
        const files = await db.collection('files')
            .find({ userId })
            .sort({ timestamp: -1 })
            .toArray();
            
        // Only send necessary information about locked content
        const processedNotes = notes.map(note => ({
            ...note,
            content: note.isPadLocked ? null : note.content,
            padLockCode: undefined
        }));
        
        const processedFiles = files.map(file => ({
            ...file,
            padLockCode: undefined
        }));
        
        res.json({
            notes: processedNotes,
            files: processedFiles
        });
    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({ message: 'Error fetching content' });
    }
});

// Add endpoint to verify pad lock code
app.post('/api/verify-padlock', async (req, res) => {
    try {
        const { userId, contentId, padLockCode } = req.body;
        
        if (!userId || !contentId || !padLockCode) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        const note = await db.collection('notes').findOne({ _id: ObjectId(contentId), userId });
        const file = await db.collection('files').findOne({ _id: ObjectId(contentId), userId });
        
        const content = note || file;
        
        if (!content) {
            return res.status(404).json({ message: 'Content not found' });
        }
        
        if (content.padLockCode !== padLockCode) {
            return res.status(401).json({ message: 'Invalid pad lock code' });
        }
        
        // Return the full content if pad lock code is correct
        res.json({
            content: note ? note.content : file.filename
        });
    } catch (error) {
        console.error('Error verifying pad lock:', error);
        res.status(500).json({ message: 'Error verifying pad lock' });
    }
}); 