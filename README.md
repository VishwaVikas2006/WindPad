# GlobalPad

A simple note-taking and file sharing application built with Node.js, Express, and MongoDB Atlas.

## Features

- User-based note management and file sharing
- Real-time note saving and editing
- File upload support (up to 10MB)
  - PDF documents
  - Microsoft Word documents (.doc, .docx)
  - PowerPoint presentations (.ppt, .pptx)
  - Images (jpg, png)
  - Text files
- File management (download, delete)
- Simple and modern UI
- No account required - just use an access code

## Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account
- npm or yarn package manager

## Setup

1. Clone the repository:
```bash
git clone https://github.com/VishwaVikas2006/WindPad.git
cd globalpad
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your MongoDB connection string:
```
MONGODB_URI=mongodb+srv://vishwavikas4444:Vishwa@cluster0.lrhrsuf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
PORT=3000
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Enter an access code to start using GlobalPad
2. Write and save notes in the text editor
3. Upload files (max 10MB) using the upload button
4. View, download, or delete your files from the list
5. Use Save & Close or Close to return to the home page
6. Use the same access code to access your notes and files later

## API Endpoints

- `POST /api/note` - Save a note
- `GET /api/notes/user/:userId` - Get notes for a user
- `POST /api/upload` - Upload a file
- `GET /api/files/user/:userId` - Get all files for a user
- `GET /api/download/:fileId` - Download a file
- `DELETE /api/delete/:fileId` - Delete a file

## License

MIT 