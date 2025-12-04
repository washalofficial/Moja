import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Example route
app.get('/api', (req, res) => {
  res.json({ message: 'Hello from Cloudflare Pages!' });
});

// Add more routes as needed

// Cloudflare Pages expects a module worker, so we adapt the Express app.
export async function onRequest(context) {
  // Create a request listener from the Express app.
  const listener = app.handle;

  // Wrap the request in a Node.js-compatible Request object
  const request = new Request(context.request.url, {
    method: context.request.method,
    headers: context.request.headers
  });

  // Convert the Request to a Node.js-compatible req object 
  const { readable, writable } = new TransformStream();
  context.request.body?.pipeTo(writable).catch(() => {}); // Handle possible errors during piping
  const req = Object.assign(readable, {  // Merge readable stream with req object
      method: context.request.method,
      url: context.request.url,
      headers: context.request.headers,
  });

  // Create a Node.js-compatible res object
  const res = {
    headers: {},
    setHeader: (name, value) => {
      res.headers[name] = value;
    },
    end: (data) => {
      let body = data;
      let status = res.statusCode || 200;
      let headers = res.headers;

      if (typeof data === 'object') {
        body = JSON.stringify(data);
        headers = { ...headers, 'Content-Type': 'application/json' };
      }
      return new Response(body, { status, headers });
    },
    writeHead: (statusCode) => {
      res.statusCode = statusCode;
    }
  };

  return new Promise((resolve) => {
      listener(req, res, () => {
          if (!res.writableEnded) {
            res.statusCode = 404;
            res.end('Not Found');
          }
          resolve(res.end());
      });
  });

}

class TransformStream {
  constructor() {
      this.readable = new ReadableStream({start: (controller) => {
          this.controller = controller;
      }});
      this.writable = new WritableStream({write: (chunk) => {
          this.controller.enqueue(chunk);
      }, close: () => {
          this.controller.close();
      }});
  }
}

