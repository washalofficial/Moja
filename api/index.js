// api/index.js

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory that vite generates
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Environment Variable
const apiKey = process.env.API_KEY || `HZOC1XZhTr2wwUSphUS68yNY`;

// Example API endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Vercel serverless function!', apiKey });
});

// Example data endpoint (using pg for postgresql - based on your dependencies).
import pg from 'pg'
const { Client } = pg;

const dbConfig = {
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'postgres',
  password: process.env.PGPASSWORD || 'password',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
};

app.get('/api/data', async (req, res) => {
  const client = new Client(dbConfig);

  try {
    await client.connect();
    const result = await client.query('SELECT NOW() as now');
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  } finally {
    await client.end();
  }
});


// Handle client-side routing - ensures that react-router still works.
app.get('*', (req, res) => {
  res.sendFile(join(publicDir, 'index.html'));
});

// For Vercel, we don't start the server.  Vercel handles that.
// But for local testing:
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
}

export default app;
