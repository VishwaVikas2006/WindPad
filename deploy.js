const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
mongoose.connect('mongodb+srv://vishwavikas4444:Vishwa@cluster0.lrhrsuf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Schemas
const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    isPadLocked: {
        type: Boolean,
        default: false
    },
    padLockCode: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const noteSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
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

const fileSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    filename: String,
    path: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Models
const User = mongoose.model('User', userSchema);
const Note = mongoose.model('Note', noteSchema);
const File = mongoose.model('File', fileSchema);

// Routes
app.get('/api/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        let user = await User.findOne({ userId });
        
        if (!user) {
            user = new User({ userId });
            await user.save();
        }
        
        res.json({
            userId: user.userId,
            isPadLocked: user.isPadLocked,
            padLockCode: user.padLockCode
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/user/update', async (req, res) => {
    try {
        const { userId, isPadLocked, padLockCode } = req.body;
        
        let user = await User.findOne({ userId });
        if (!user) {
            user = new User({ userId });
        }
        
        user.isPadLocked = isPadLocked;
        user.padLockCode = padLockCode;
        await user.save();
        
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/notes/user/:userId', async (req, res) => {
    try {
        const notes = await Note.find({ userId: req.params.userId })
            .sort({ createdAt: -1 });
        res.json(notes);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/notes', async (req, res) => {
    try {
        const { userId, content } = req.body;
        
        // Update or create note
        const note = await Note.findOneAndUpdate(
            { userId },
            { content },
            { upsert: true, new: true }
        );
        
        res.json(note);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/files/user/:userId', async (req, res) => {
    try {
        const files = await File.find({ userId: req.params.userId })
            .sort({ createdAt: -1 });
        res.json(files);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 