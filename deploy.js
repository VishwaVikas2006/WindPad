const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
// const { GridFsStorage } = require('multer-gridfs-storage'); // Removed old import
const { GridFSBucket } = require('mongodb'); // Import GridFSBucket directly
const { connectDB, getGfs } = require('./config/db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Cache control middleware
const nocache = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Expires', '-1');
    res.set('Pragma', 'no-cache');
    next();
};

app.use(nocache);

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
        userId: {
            type: String,
            required: true
        },
        title: {
            type: String,
            default: 'Untitled Note'
        },
        content: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    });

    const Note = mongoose.model('Note', noteSchema);

    // API Routes
    app.post('/api/upload', upload.single('file'), (err, req, res, next) => {
        if (err) {
            // This is a Multer error. Pass it to the global error handler.
            return next(err);
        }
        next(); // Continue to the next middleware/route handler
    }, async (req, res, next) => {
        try {
            if (!req.file) {
                // Pass this error to the global error handler
                return next(new Error('No file uploaded'));
            }

            console.log('req.file after upload:', req.file); // Debugging line

            if (!req.body.userId) {
                return res.status(400).json({ message: 'User ID is required' });
            }

            const newFile = new File({
                filename: req.file.originalname, // Multer 2.x and custom storage passes originalname
                contentType: req.file.mimetype,
                size: req.file.size,
                fileId: req.file.id, // Now directly available as 'id' from our custom storage
                userId: req.body.userId,
                metadata: {
                    ...req.file.metadata,
                    uploadedAt: new Date(),
                    originalName: req.file.originalname
                }
            });

            await newFile.save();
            res.status(201).json({
                message: 'File uploaded successfully',
                file: newFile
            });
        } catch (error) {
            console.error('Error in /api/upload handler:', error); // Debugging line
            return next(error); // Pass any caught error to the global error handler
        }
    });

    app.get('/api/files/user/:userId', async (req, res) => {
        try {
            if (!req.params.userId) {
                return res.status(400).json({ message: 'User ID is required' });
            }

            const files = await File.find({
                $or: [
                    { userId: req.params.userId },
                    { 'savedBy.userId': req.params.userId }
                ]
            })
            .select('filename fileId size uploadDate contentType userId savedBy')
            .lean();

            res.json(files || []);
        } catch (error) {
            console.error('Error fetching files:', error);
            res.status(500).json({ message: 'Error fetching files' });
        }
    });

    app.post('/api/save/:fileId', async (req, res) => {
        try {
            if (!req.body.userId) {
                return res.status(400).json({ message: 'User ID is required' });
            }

            const file = await File.findOne({ fileId: new mongoose.Types.ObjectId(req.params.fileId) });
            if (!file) {
                return res.status(404).json({ message: 'File not found' });
            }

            // Check if user has already saved this file
            const alreadySaved = file.savedBy.some(save => save.userId === req.body.userId);
            if (alreadySaved) {
                return res.status(400).json({ message: 'File already saved' });
            }

            // Add user to savedBy array
            file.savedBy.push({
                userId: req.body.userId,
                savedAt: new Date()
            });

            await file.save();
            res.json({ message: 'File saved successfully' });
        } catch (error) {
            console.error('Save error:', error);
            res.status(500).json({ message: 'Error saving file' });
        }
    });

    app.get('/api/download/:fileId', async (req, res) => {
        try {
            const file = await File.findOne({ fileId: new mongoose.Types.ObjectId(req.params.fileId) });
            if (!file) {
                return res.status(404).json({ message: 'File not found' });
            }

            const gfs = getGfs();
            if (!gfs) {
                return res.status(500).json({ message: 'File system not initialized' });
            }

            const downloadStream = gfs.openDownloadStream(new mongoose.Types.ObjectId(file.fileId));
            res.set('Content-Type', file.contentType);
            res.set('Content-Disposition', `attachment; filename="${file.filename}"`);
            downloadStream.pipe(res);
        } catch (error) {
            console.error('Download error:', error);
            res.status(500).json({ message: 'Error downloading file' });
        }
    });

    app.delete('/api/delete/:fileId', async (req, res) => {
        try {
            const file = await File.findOne({ fileId: new mongoose.Types.ObjectId(req.params.fileId) });
            if (!file) {
                return res.status(404).json({ message: 'File not found' });
            }

            // Only allow file owner to delete
            if (file.userId !== req.body.userId) {
                return res.status(403).json({ message: 'Not authorized to delete this file' });
            }

            const gfs = getGfs();
            if (!gfs) {
                return res.status(500).json({ message: 'File system not initialized' });
            }

            // Use our custom storage's _removeFile method or directly use GridFSBucket
            // Since we have file.id, we can directly delete using GridFSBucket
            await gfs.delete(new mongoose.Types.ObjectId(file.fileId));
            await File.deleteOne({ _id: file._id });
            res.json({ message: 'File deleted successfully' });
        } catch (error) {
            console.error('Delete error:', error);
            res.status(500).json({ message: 'Error deleting file' });
        }
    });

    // New API Route for Saving Notes
    app.post('/api/note', async (req, res, next) => {
        try {
            const { userId, content, title } = req.body;

            if (!userId || !content) {
                return res.status(400).json({ message: 'User ID and content are required to save a note.' });
            }

            const newNote = new Note({
                userId,
                content,
                title: title || 'Untitled Note'
            });

            await newNote.save();
            res.status(201).json({ message: 'Note saved successfully', noteId: newNote._id });

        } catch (error) {
            console.error('Error saving note:', error);
            if (error instanceof mongoose.Error.ValidationError) {
                return next(error); // Pass Mongoose validation errors to global handler
            }
            next(new Error('Failed to save note: ' + error.message)); // General error
        }
    });

    // New API Route for Getting Notes by User
    app.get('/api/notes/user/:userId', async (req, res, next) => {
        try {
            const { userId } = req.params;
            if (!userId) {
                return res.status(400).json({ message: 'User ID is required to fetch notes.' });
            }
            const notes = await Note.find({ userId: userId }).sort({ createdAt: -1 });
            res.status(200).json(notes);
        } catch (error) {
            console.error('Error fetching notes:', error);
            next(new Error('Failed to fetch notes: ' + error.message));
        }
    });

    // New API Route for Getting a Single Note
    app.get('/api/note/:noteId', async (req, res, next) => {
        try {
            const { noteId } = req.params;
            if (!noteId) {
                return res.status(400).json({ message: 'Note ID is required.' });
            }
            const note = await Note.findById(noteId);
            if (!note) {
                return res.status(404).json({ message: 'Note not found.' });
            }
            res.status(200).json(note);
        } catch (error) {
            console.error('Error fetching single note:', error);
            next(new Error('Failed to fetch note: ' + error.message));
        }
    });

    // New API Route for Deleting a Note
    app.delete('/api/note/:noteId', async (req, res, next) => {
        try {
            const { noteId } = req.params;
            const { userId } = req.body; // Assuming userId is sent for authorization

            if (!noteId) {
                return res.status(400).json({ message: 'Note ID is required to delete a note.' });
            }
            if (!userId) {
                return res.status(400).json({ message: 'User ID is required for authorization to delete a note.' });
            }

            const note = await Note.findById(noteId);
            if (!note) {
                return res.status(404).json({ message: 'Note not found.' });
            }

            // Basic authorization: ensure the note belongs to the user trying to delete it
            if (note.userId !== userId) {
                return res.status(403).json({ message: 'Unauthorized: This note does not belong to the provided user ID.' });
            }

            await Note.findByIdAndDelete(noteId);
            res.status(200).json({ message: 'Note deleted successfully' });

        } catch (error) {
            console.error('Error deleting note:', error);
            next(new Error('Failed to delete note: ' + error.message));
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