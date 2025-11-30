import express, { Request, Response } from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const { Client } = pg;

// Rate limiting map: track failed attempts per IP
const failedAttempts = new Map<string, { count: number; timestamp: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const attempt = failedAttempts.get(ip);
  
  if (attempt && now - attempt.timestamp < LOCKOUT_DURATION && attempt.count >= MAX_ATTEMPTS) {
    return false;
  }
  
  if (!attempt || now - attempt.timestamp > LOCKOUT_DURATION) {
    failedAttempts.set(ip, { count: 0, timestamp: now });
  }
  
  return true;
};

const recordFailedAttempt = (ip: string) => {
  const attempt = failedAttempts.get(ip);
  if (attempt) {
    attempt.count++;
  } else {
    failedAttempts.set(ip, { count: 1, timestamp: Date.now() });
  }
};

const clearAttempts = (ip: string) => {
  failedAttempts.delete(ip);
};

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

const ADMIN_PASSWORD = process.env.VITE_ADMIN_PASSWORD || '548413';

let dbClient: pg.Client | null = null;

async function initDatabase() {
  try {
    dbClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    
    await dbClient.connect();
    console.log('✅ Database connected');

    // Create ads table if it doesn't exist
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS placement_ads (
        id SERIAL PRIMARY KEY,
        placement_key VARCHAR(50) UNIQUE NOT NULL,
        ad_config JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Database tables ready');
  } catch (error) {
    console.error('❌ Database error:', error);
    setTimeout(initDatabase, 3000);
  }
}

// GET all ads
app.get('/api/ads', async (req: Request, res: Response) => {
  try {
    if (!dbClient) {
      return res.status(503).json({ error: 'Database not ready' });
    }

    const result = await dbClient.query('SELECT placement_key, ad_config FROM placement_ads');
    
    const adsMap: Record<string, any> = {};
    result.rows.forEach(row => {
      adsMap[row.placement_key] = row.ad_config;
    });

    res.json(adsMap);
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({ error: 'Failed to fetch ads' });
  }
});

// SAVE single ad (requires admin password)
app.post('/api/ads/save', async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || 'unknown';
    
    // Check rate limiting
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }

    const { password, placement_key, ad_config } = req.body;

    if (password !== ADMIN_PASSWORD) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    clearAttempts(clientIp);

    if (!placement_key || !ad_config) {
      return res.status(400).json({ error: 'Missing placement_key or ad_config' });
    }

    if (!dbClient) {
      return res.status(503).json({ error: 'Database not ready' });
    }

    await dbClient.query(
      `INSERT INTO placement_ads (placement_key, ad_config, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (placement_key) 
       DO UPDATE SET ad_config = $2, updated_at = CURRENT_TIMESTAMP`,
      [placement_key, JSON.stringify(ad_config)]
    );

    res.json({ success: true, message: `Ad saved to ${placement_key}` });
  } catch (error) {
    console.error('Error saving ad:', error);
    res.status(500).json({ error: 'Failed to save ad' });
  }
});

// DELETE single ad (requires admin password)
app.post('/api/ads/delete', async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || 'unknown';
    
    // Check rate limiting
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }

    const { password, placement_key } = req.body;

    if (password !== ADMIN_PASSWORD) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    clearAttempts(clientIp);

    if (!placement_key) {
      return res.status(400).json({ error: 'Missing placement_key' });
    }

    if (!dbClient) {
      return res.status(503).json({ error: 'Database not ready' });
    }

    await dbClient.query(
      'DELETE FROM placement_ads WHERE placement_key = $1',
      [placement_key]
    );

    res.json({ success: true, message: `Ad deleted from ${placement_key}` });
  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json({ error: 'Failed to delete ad' });
  }
});

// DELETE all ads (requires admin password)
app.post('/api/ads/delete-all', async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || 'unknown';
    
    // Check rate limiting
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }

    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    clearAttempts(clientIp);

    if (!dbClient) {
      return res.status(503).json({ error: 'Database not ready' });
    }

    await dbClient.query('DELETE FROM placement_ads');

    res.json({ success: true, message: 'All ads deleted' });
  } catch (error) {
    console.error('Error deleting all ads:', error);
    res.status(500).json({ error: 'Failed to delete all ads' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  initDatabase();
});

export default app;
