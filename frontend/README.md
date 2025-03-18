# Tech Reader Frontend

This is the frontend for the Tech Reader application, a PDF reader with AI-powered features.

## API Integration

The frontend integrates with the backend v1 APIs for the following functionality:

### Authentication
- User registration
- User login
- Authentication check

### PDF Management
- Fetching all PDFs
- Uploading new PDFs
- Viewing PDFs

### Notes & Highlights
- Creating and managing notes
- Creating and managing highlights

### RAG (Retrieval Augmented Generation)
- Querying the AI about PDF content
- Contextual conversations about the document

## Setup

1. Install dependencies:
```
npm install
```

2. Start the development server:
```
npm start
```

3. Make sure the backend server is running at `http://localhost:5000`

## API Service

The API integration is handled through the `services/api.js` file, which provides:

- Axios instance with authentication headers
- Organized API functions by category (auth, pdf, notes, highlights, rag)
- Error handling

## Authentication Flow

1. User logs in or registers
2. JWT token is stored in localStorage
3. Token is automatically added to API requests
4. Protected routes check authentication status

## Development

To add new API integrations:
1. Add the endpoint to the appropriate section in `services/api.js`
2. Use the API in your components
3. Handle loading states and errors appropriately 