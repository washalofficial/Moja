import { createPagesFunctionHandler } from '@remix-run/cloudflare-pages';
import * as build from '../build/index.js';

const handleRequest = createPagesFunctionHandler({
  build,
  mode: process.env.NODE_ENV,
  getLoadContext: (context) => {
    return {
      env: context.env,
    };
  },
});

export function onRequest(context) {
  return handleRequest(context);
}
