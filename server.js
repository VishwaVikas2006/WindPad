const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/globalpad', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Define schemas
const noteSchema = new mongoose.Schema({
    userId: String,
    title: String,
    content: String,
    isPrivate: Boolean,
    privateCode: String,
    createdAt: { type: Date, default: Date.now }
});

const fileSchema = new mongoose.Schema({
    userId: String,
    filename: String,
    path: String,
    isPrivate: Boolean,
    privateCode: String,
    createdAt: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', noteSchema);
const File = mongoose.model('File', fileSchema);

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(cors());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Helper function to verify private code
function verifyPrivateCode(storedCode, providedCode) {
    if (!storedCode) return true;
    if (!providedCode) return false;
    return storedCode === providedCode;
}

// API Routes
app.post('/api/notes', async (req, res) => {
    try {
        const { userId, title, content, isPrivate, privateCode } = req.body;
        
        if (!userId || !title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        const note = new Note({
            userId,
            title,
            content,
            isPrivate: !!isPrivate,
            privateCode: isPrivate ? privateCode : null
        });
        
        await note.save();
        
        res.json({
            success: true,
            message: 'Note saved successfully',
            data: {
                id: note._id,
                title: note.title,
                isPrivate: note.isPrivate
            }
        });
    } catch (error) {
        console.error('Error saving note:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving note'
        });
    }
});

app.get('/api/notes/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { privateCode } = req.query;
        
        const notes = await Note.find({ userId });
        
        const processedNotes = notes.map(note => {
            const isAccessible = !note.isPrivate || verifyPrivateCode(note.privateCode, privateCode);
            return {
                id: note._id,
                title: isAccessible ? note.title : 'Private Note',
                content: isAccessible ? note.content : null,
                isLocked: !isAccessible,
                createdAt: note.createdAt
            };
        });
        
        res.json({
            success: true,
            data: processedNotes
        });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notes'
        });
    }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }
        
        const { userId, isPrivate, privateCode } = req.body;
        
        const file = new File({
            userId,
            filename: req.file.originalname,
            path: req.file.path,
            isPrivate: !!isPrivate,
            privateCode: isPrivate ? privateCode : null
        });
        
        await file.save();
        
        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                id: file._id,
                filename: file.filename,
                isPrivate: file.isPrivate
            }
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            success: false,
            message: 'Error uploading file'
        });
    }
});

app.get('/api/files/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { privateCode } = req.query;
        
        const files = await File.find({ userId });
        
        const processedFiles = files.map(file => {
            const isAccessible = !file.isPrivate || verifyPrivateCode(file.privateCode, privateCode);
            return {
                fileId: file._id,
                filename: isAccessible ? file.filename : 'Private File',
                isLocked: !isAccessible,
                userId: file.userId,
                createdAt: file.createdAt
            };
        });
        
        res.json(processedFiles);
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching files'
        });
    }
});

app.get('/api/download/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { privateCode } = req.query;
        
        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }
        
        if (file.isPrivate && !verifyPrivateCode(file.privateCode, privateCode)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        res.download(file.path, file.filename);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({
            success: false,
            message: 'Error downloading file'
        });
    }
});

app.delete('/api/delete/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { userId } = req.body;
        
        const file = await File.findOne({ _id: fileId, userId });
        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }
        
        // Delete the file from storage
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        
        // Delete the file record
        await file.deleteOne();
        
        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting file'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size exceeds 10MB limit'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'File upload error'
        });
    }
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 