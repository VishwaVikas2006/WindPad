# WindPad

A secure note-taking and file-sharing web application with advanced privacy features.

## Features

- Secure note-taking with pad lock protection
- File sharing capabilities
- User-specific content management
- Real-time content updates
- Modern and intuitive UI
- Second-level encryption for sensitive content

## Installation

1. Clone the repository:
```bash
git clone https://github.com/VishwaVikas2006/WindPad.git
```

2. Install dependencies:
```bash
cd WindPad
npm install
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Usage

1. Enter an access code to create or access your pad
2. Use the pad lock feature to add an extra layer of security to your content
3. Save and manage your notes and files securely
4. Use the same access code to return to your content later

## Pad Lock Feature

The pad lock feature provides an additional layer of security for your content:

1. Toggle the pad lock switch in the editor header
2. Enter a second code to encrypt your content
3. Your content will be locked and require both codes to access:
   - First code: Access code to enter the pad
   - Second code: Pad lock code to decrypt content

## License

This project is licensed under the MIT License - see the LICENSE file for details.
