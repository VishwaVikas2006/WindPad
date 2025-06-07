# GlobalPad

A simple and secure file sharing and note-taking application built with Node.js, Express, and MongoDB Atlas.

## Features

- User-based file and note management
- Real-time note editing
- File upload support:
  - PDF documents
  - Images (JPG, PNG, GIF)
  - PowerPoint presentations (PPT, PPTX)
  - Word documents (DOC, DOCX)
- 10MB file size limit
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
MONGODB_URI=your_mongodb_connection_string
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
2. Type notes in the editor
3. Upload files using the upload section
4. Use the buttons to:
   - Save & Close: Save your work and return to home
   - Save: Save your work and continue editing
   - Refresh: Clear the editor (with confirmation)
   - Close: Return to home (with confirmation)

## File Limitations

- Maximum file size: 10MB
- Supported file types:
  - PDF documents
  - Images (JPG, PNG, GIF)
  - PowerPoint presentations (PPT, PPTX)
  - Word documents (DOC, DOCX)

## API Endpoints

- `POST /api/files/upload` - Upload a file
- `GET /api/files/:fileId` - Download a file
- `DELETE /api/files/:fileId` - Delete a file
- `GET /api/files/user/:userId` - Get all files for a user

## License

MIT 