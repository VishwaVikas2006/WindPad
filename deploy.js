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

    _handleFile(req, file, cb) {
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
                }
            });
            console.log('GridFS upload stream opened successfully.', uploadStream.id);
        } catch (err) {
            console.error('Error opening GridFS upload stream:', err);
            return cb(err);
        }

        file.stream.pipe(uploadStream);

        uploadStream.on('error', (err) => {
            console.error('GridFS uploadStream error:', err);
            cb(err);
        });

        uploadStream.on('close', () => {
            console.log('GridFS uploadStream closed.');
        });

        file.stream.on('data', (chunk) => {
            console.log(`Received ${chunk.length} bytes from file.stream`);
        });
        file.stream.on('end', () => {
            console.log('file.stream ended.');
        });
        file.stream.on('error', (err) => {
            console.error('file.stream error:', err);
        });

        uploadStream.on('finish', (uploadedFile) => {
            console.log('GridFS uploadStream finished. uploadedFile:', uploadedFile);
            // The 'uploadedFile' object here is the GridFS file document
            // We need to return the information Multer expects in req.file
            if (!uploadedFile) {
                console.error('CRITICAL: uploadedFile is undefined/null in finish event for file:', file.originalname);
                return cb(new Error('File upload to GridFS failed: uploaded file object is undefined or null.'));
            }
            cb(null, {
                filename: uploadedFile.filename,
                originalname: file.originalname,
                mimetype: uploadedFile.contentType,
                size: uploadedFile.length,
                id: uploadedFile._id, // This is the ObjectId from GridFS
                bucketName: this.bucketName,
                uploadDate: uploadedFile.uploadDate,
                metadata: uploadedFile.metadata
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

            // Use our custom storage's _removeFile method or directly use GridFSBucket.delete
            // Since we have file.id, we can directly delete using GridFSBucket
            await gfs.delete(new mongoose.Types.ObjectId(file.fileId));
            await File.deleteOne({ _id: file._id });
            res.json({ message: 'File deleted successfully' });
        } catch (error) {
            console.error('Delete error:', error);
            res.status(500).json({ message: 'Error deleting file' });
        }
    });

    // Start server after all setup
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

}).catch(err => {
    console.error('Failed to connect to database:', err);
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