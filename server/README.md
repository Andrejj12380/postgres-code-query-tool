# Server for Postgres Query Tool

This small Express server exposes two endpoints used by the frontend:

- POST /api/summary
  - Body: { connection, selectedGtin, startDate, endDate, dateField }
  - Returns: [{ gtin, count }]

- POST /api/full
  - Body: { connection, selectedGtin, startDate, endDate, dateField, limit }
  - Returns: rows from `codes` table

Security notes:
- This server expects the client to send full DB connection details (host, port, user, password, database). For production use, do NOT send credentials from the browser; instead keep connections server-side or implement server-side saved connections with proper auth.

Run locally:
1. Install server dependencies (in repo root):
   ```bash
   npm install
   ```
2. Start the server (dev):
   ```bash
   npm run dev:server
   ```
   or
   ```bash
   npm run server
   ```
