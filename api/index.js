import express from 'express';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue } from 'firebase/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client } from 'pg';

// Load environment variables (if needed for local development)
// require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Firebase configuration (use environment variables on Vercel)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// Google Generative AI configuration (use environment variables on Vercel)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// PostgreSQL configuration (use environment variables on Vercel)
const pgClient = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false // Required for some cloud PostgreSQL instances
  }
});

// Initialize PostgreSQL connection
async function connectToPostgres() {
  try {
    await pgClient.connect();
    console.log('Connected to PostgreSQL');
  } catch (error) {
    console.error('Error connecting to PostgreSQL:', error);
  }
}

connectToPostgres();

app.get('/api', (req, res) => {
  res.send('Hello from Express on Vercel!');
});

app.get('/api/firebaseData', (req, res) => {
  const messagesRef = ref(database, 'messages');

  onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();
    res.json(data);
  }, (error) => {
    console.error("Error fetching data from Firebase:", error);
    res.status(500).json({ error: "Failed to fetch data from Firebase" });
  });
});

app.post('/api/firebaseData', async (req, res) => {
  const { message } = req.body;

  const messagesRef = ref(database, 'messages');

  try {
    const newMessageRef = await push(messagesRef, { message: message });
    console.log("Pushed new message to Firebase:", newMessageRef.key);
    res.status(201).json({ message: 'Message added to Firebase!' });
  } catch (error) {
    console.error("Error pushing data to Firebase:", error);
    res.status(500).json({ error: "Failed to add message to Firebase" });
  }
});


app.get('/api/genai', async (req, res) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = "Tell me a joke.";

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        res.send(text);
    } catch (error) {
        console.error("Error calling Google GenAI:", error);
        res.status(500).json({ error: "Failed to call Google GenAI" });
    }
});

app.get('/api/postgres', async (req, res) => {
  try {
    const result = await pgClient.query('SELECT NOW()');
    res.json({ now: result.rows[0].now });
  } catch (error) {
    console.error('Error querying PostgreSQL:', error);
    res.status(500).json({ error: 'Failed to query PostgreSQL' });
  }
});

// Vercel Serverless Function handler
export default async function handler(req, res) {
  await app(req, res);
}

