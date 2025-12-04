import express from 'express';
import cors from 'cors';
import { generate } from './generate.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api', (req, res) => {
  res.send('Hello from Vercel!');
});

app.post('/api/generate', async (req, res) => {
  try {
      const prompt = req.body.prompt;
      const result = await generate(prompt);
      res.json({ result });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to generate text' });
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
