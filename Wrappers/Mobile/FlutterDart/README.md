# Flutter Mobile Application

This directory is intended for the Flutter mobile application, written in the Dart language.

## Architecture

The Flutter application will act as a client to the Node.js web server. It will not directly interface with the `CoreLogic` TypeScript code. Instead, it will make HTTP requests to the REST API endpoints exposed by the web application located in `Wrappers/Web/NodeJs`.

### Why this approach?

- **Language Interoperability:** Dart and TypeScript/JavaScript cannot be run in the same process directly. A web API is the standard way to bridge applications written in different languages.
- **Single Backend:** This ensures that all three clients (Desktop, Web, Mobile) are communicating with the exact same business logic and database, managed by the Node.js server which uses `CoreLogic`.
- **Development Efficiency:** The Flutter team can develop the mobile UI and logic by calling well-defined API endpoints, without needing to understand or run the TypeScript backend code.

### Getting Started

1. **Run the Node.js Web Server:**
   - Navigate to the root of the project.
   - Run `npm install` to install all dependencies for all workspaces.
   - Run `npm run start:web` to start the web server.

2. **Develop the Flutter App:**
   - Use the standard Flutter tooling (`flutter create .`, etc.) to develop the application in this directory.
   - Use an HTTP client package in Flutter (like `http` or `dio`) to make requests to the local web server (e.g., `http://localhost:3000/tasks`).
   - The API endpoints will provide all the necessary data for the mobile app to function.
