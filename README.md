# GlobalPad

A simple and secure file sharing web application with pad lock feature for enhanced privacy.

## Features

- Create and manage notes with unique access codes
- Upload and share files (up to 10MB)
- Pad lock feature for additional security
- Real-time saving and updates
- Modern and responsive UI
- Second-level encryption for sensitive content

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/VishwaVikas2006/WindPad.git
cd WindPad
```

2. Install dependencies:
```bash
npm install
```

3. Make sure MongoDB is running on your system.

4. Start the application:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Usage

1. Access the application through your web browser
2. Enter any access code to create or access your notes
3. Use the pad lock feature for additional security:
   - Toggle the pad lock switch
   - Enter a pad lock code
   - Your content will be encrypted and locked
4. Upload files using the upload button
5. Save your changes and close when done

## Security Features

- Access code-based note management
- Pad lock feature with second-level encryption
- Secure file upload handling
- MongoDB for persistent storage

## Contributing

Feel free to submit issues and enhancement requests.

## License

[MIT](LICENSE) 