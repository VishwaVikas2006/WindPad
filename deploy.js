const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
// const { GridFsStorage } = require('multer-gridfs-storage'); // Removed old import
const { GridFSBucket } = require('mongodb'); // Import GridFSBucket directly
const { connectDB, getGfs } = require('./config/db');
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Cache control middleware
const nocache = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Expires', '-1');
    res.set('Pragma', 'no-cache');
    next();
};

app.use(nocache);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Custom Multer GridFS Storage Engine
class GridFsStorageEngine {
    constructor(options) {
        this.connection = options.connection;
        this.bucketName = options.bucketName || 'uploads';
        this.options = options;
    }

    async _handleFile(req, file, cb) {
        console.log('Inside _handleFile. Database connection state (this.connection.readyState):', this.connection.readyState);
        if (this.connection.readyState !== 1) {
            console.error('Database not connected when _handleFile called. ReadyState:', this.connection.readyState);
            return cb(new Error('Database not connected. ReadyState: ' + this.connection.readyState));
        }

        const bucket = new GridFSBucket(this.connection.db, { bucketName: this.bucketName });
        let uploadStream;
        try {
            uploadStream = bucket.openUploadStream(file.originalname, {
                contentType: file.mimetype,
                metadata: {
                    userId: req.body.userId || 'anonymous',
                    originalName: file.originalname,
                    uploadedAt: new Date()
                },
                writeConcern: { w: 'majority' }
            });
            console.log('GridFS upload stream opened successfully. Stream ID:', uploadStream.id);
        } catch (err) {
            console.error('Error opening GridFS upload stream:', err);
            return cb(err);
        }

        file.stream.pipe(uploadStream);

        uploadStream.on('error', (err) => {
            console.error('!!! GridFS uploadStream FATAL ERROR !!!:', err);
            cb(err);
        });

        uploadStream.on('close', () => {
            console.log('GridFS uploadStream closed.');
        });

        uploadStream.on('drain', () => {
            console.log('GridFS uploadStream drained (ready for more data).');
        });

        file.stream.on('data', (chunk) => {
            // console.log(`Received ${chunk.length} bytes from file.stream`); // Keep this less verbose now, focus on uploadStream events
        });
        file.stream.on('end', () => {
            console.log('file.stream ended.');
        });
        file.stream.on('error', (err) => {
            console.error('file.stream error (source stream):', err);
        });

        uploadStream.on('finish', async (uploadedFile) => {
            console.log('GridFS uploadStream finished. uploadedFile (from event):', uploadedFile);
            console.log('GridFS uploadStream ID at finish:', uploadStream.id);
            console.log('uploadStream.writableEnded:', uploadStream.writableEnded);
            console.log('uploadStream.writableFinished:', uploadStream.writableFinished);

            let finalUploadedFile = uploadedFile; // Start with the file from the event

            if (!finalUploadedFile) {
                console.error('CRITICAL: uploadedFile is undefined/null in finish event for file:', file.originalname, 'Stream ID:', uploadStream.id);
                try {
                    console.log('Attempting to find file in fs.files collection using stream ID:', uploadStream.id);
                    const files = await bucket.find({ _id: uploadStream.id }).toArray();
                    if (files && files.length > 0) {
                        console.log('SUCCESS: Found file in fs.files collection after finish event:', files[0]);
                        finalUploadedFile = files[0]; // Assign the found file to finalUploadedFile
                    } else {
                        console.log('File NOT found in fs.files collection after finish event. Stream ID:', uploadStream.id, 'Attempting to find chunks...');
                        const chunks = await this.connection.db.collection('uploads.chunks').find({ files_id: uploadStream.id }).toArray();
                        if (chunks && chunks.length > 0) {
                            console.log(`Found ${chunks.length} chunks for file ID ${uploadStream.id} in uploads.chunks collection. File document might be missing.`);
                        } else {
                            console.log(`No chunks found for file ID ${uploadStream.id} in uploads.chunks collection. This indicates a complete write failure.`);
                        }
                    }
                } catch (queryErr) {
                    console.error('ERROR during manual file/chunk query after failed upload:', queryErr);
                }
            }

            // If after all checks, finalUploadedFile is still undefined, then it's a genuine failure to report to Multer
            if (!finalUploadedFile) {
                console.error('FINAL CRITICAL: File upload to GridFS failed: uploaded file object is undefined or null, and manual lookup failed.');
                // Only abort if not already destroyed/finished, and it's a genuine persistence failure
                if (!uploadStream.destroyed) { 
                    uploadStream.abort(() => {
                        console.log('Upload stream aborted due to persistence failure (no file document found).');
                        cb(new Error('File upload to GridFS failed: Data not persisted.'));
                    });
                } else {
                    // If stream already destroyed, just return the error immediately
                    cb(new Error('File upload to GridFS failed: Data not persisted (stream already handled/destroyed).'));
                }
                return;
            }

            // If we reach here, finalUploadedFile should either be the one from the event or the one we found manually.
            cb(null, {
                filename: finalUploadedFile.filename,
                originalname: file.originalname,
                mimetype: finalUploadedFile.contentType,
                size: finalUploadedFile.length,
                id: finalUploadedFile._id, // This is the ObjectId from GridFS
                bucketName: this.bucketName,
                uploadDate: finalUploadedFile.uploadDate,
                metadata: finalUploadedFile.metadata
            });
        });
    }

    _removeFile(req, file, cb) {
        const bucket = new GridFSBucket(this.connection.db, { bucketName: this.bucketName });
        bucket.delete(new mongoose.Types.ObjectId(file.id), (err) => {
            if (err) {
                return cb(err);
            }
            cb(null);
        });
    }
}

// Connect to MongoDB
connectDB().then(() => {
    console.log('Database connected successfully');

    // Update allowed file types (still relevant for validation)
    const ALLOWED_FILE_TYPES = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];

    // Initialize our custom GridFS storage
    const customGridFsStorage = new GridFsStorageEngine({
        connection: mongoose.connection,
        bucketName: 'uploads',
        fileFilter: (req, file, cb) => {
            if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
                return cb(new Error('Invalid file type. Only images, PDFs, DOCs, and TXT files are allowed.'), false);
            }
            cb(null, true);
        }
    });

    const upload = multer({
        storage: customGridFsStorage,
        limits: {
            fileSize: 10 * 1024 * 1024 // 10MB limit
        }
    });

    // File Schema
    const fileSchema = new mongoose.Schema({
        filename: {
            type: String,
            required: true
        },
        contentType: {
            type: String,
            required: true
        },
        size: {
            type: Number,
            required: true
        },
        uploadDate: {
            type: Date,
            default: Date.now
        },
        fileId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        userId: {
            type: String,
            required: true
        },
        isPadLocked: {
            type: Boolean,
            default: false
        },
        padLockCode: {
            type: String,
            default: null
        },
        metadata: {
            type: Object,
            default: {}
        },
        savedBy: [{
            userId: String,
            savedAt: {
                type: Date,
                default: Date.now
            }
        }]
    });

    const File = mongoose.model('File', fileSchema);

    // Note Schema
    const noteSchema = new mongoose.Schema({
        accessCode: { type: String, required: true, unique: true },
        content: String,
        isLocked: { type: Boolean, default: false },
        padLockCode: String,
        files: [{ name: String, path: String }]
    });

    const Note = mongoose.model('Note', noteSchema);

    // API Routes
    app.post('/api/notes', async (req, res) => {
        try {
            const { accessCode, content, isLocked, padLockCode } = req.body;
            
            let note = await Note.findOne({ accessCode });
            
            if (note) {
                note.content = content;
                note.isLocked = isLocked;
                note.padLockCode = padLockCode;
            } else {
                note = new Note({
                    accessCode,
                    content,
                    isLocked,
                    padLockCode
                });
            }
            
            await note.save();
            res.json({ success: true });
        } catch (error) {
            console.error('Error saving note:', error);
            res.status(500).json({ error: 'Failed to save note' });
        }
    });

    app.get('/api/notes/:accessCode', async (req, res) => {
        try {
            const note = await Note.findOne({ accessCode: req.params.accessCode });
            if (!note) {
                return res.json({ content: '', isLocked: false });
            }
            res.json(note);
        } catch (error) {
            console.error('Error loading note:', error);
            res.status(500).json({ error: 'Failed to load note' });
        }
    });

    app.post('/api/upload', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const { accessCode } = req.body;
            const fileName = req.file.filename;
            const filePath = req.file.path;

            let note = await Note.findOne({ accessCode });
            if (!note) {
                note = new Note({ accessCode });
            }

            note.files.push({
                name: fileName,
                path: filePath
            });

            await note.save();
            res.json({ success: true, fileName });
        } catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).json({ error: 'Failed to upload file' });
        }
    });

    app.get('/api/files/:accessCode', async (req, res) => {
        try {
            const note = await Note.findOne({ accessCode: req.params.accessCode });
            if (!note || !note.files) {
                return res.json([]);
            }
            res.json(note.files);
        } catch (error) {
            console.error('Error loading files:', error);
            res.status(500).json({ error: 'Failed to load files' });
        }
    });

    // Start server after all setup
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

}).catch(err => {
    console.error('Failed to connect to database:', err);
    console.error('Connection string used:', process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:[^:/@]+@/, ':****@') : 'Not set');
    console.error('Current IP:', require('os').networkInterfaces());
    process.exit(1);
});

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Global error handler hit:', err);

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File is too large. Maximum size is 10MB' });
        }
        return res.status(400).json({ message: err.message });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: 'Invalid file data: ' + err.message });
    }

    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ message: err.message });
    }

    if (err.message && err.message.includes('No file uploaded')) {
        return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: 'Internal server error' });
};

// Error handling middleware (should always be last)
app.use(errorHandler); 