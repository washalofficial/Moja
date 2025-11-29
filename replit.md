# GitSync Mobile

A powerful, mobile-first web tool to sync local folders directly to GitHub repositories while preserving directory structure.

## Overview

GitSync Mobile allows users to:
- Connect to GitHub repositories using Personal Access Tokens
- Select local folders and sync them to GitHub
- Smart sync that only uploads changed files (uses SHA comparison)
- Optional AI-generated commit messages using Google Gemini
- Delete remote files that no longer exist locally
- Admin panel for ad configuration

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (via CDN)
- **Icons**: Lucide React
- **AI**: Google Gemini API (optional, for commit messages)

## Project Structure

```
├── App.tsx                 # Main application component
├── index.tsx               # React entry point
├── index.html              # HTML template
├── types.ts                # TypeScript type definitions
├── vite.config.ts          # Vite configuration
├── components/
│   ├── Logger.tsx          # Terminal-style log display
│   ├── PrivacyPolicyModal.tsx  # Privacy policy modal
│   └── ConsentBanner.tsx   # Cookie consent banner
├── services/
│   ├── githubService.ts    # GitHub API client
│   └── geminiService.ts    # Gemini AI integration
└── utils/
    └── fileUtils.ts        # File utilities (base64, SHA)
```

## Running the App

The development server runs on port 5000:

```bash
npm run dev
```

## Environment Variables

For Vercel deployment, add these in **Settings → Environment Variables**:

- `VITE_ADMIN_PASSWORD`: Admin panel password (required for admin access)
- `VITE_GEMINI_API_KEY` (optional): Google Gemini API key for AI-generated commit messages

## Features

1. **GitHub Integration**: Connect with PAT tokens, supports both public and private repos
2. **Smart Sync**: Computes Git blob SHA to skip unchanged files
3. **Branch Support**: Target any branch, creates new branches if needed
4. **Target Path**: Sync to a specific subfolder in the repository
5. **Delete Missing**: Option to remove files from remote that don't exist locally
6. **AI Commit Messages**: Uses Gemini to generate descriptive commit messages
7. **Admin Panel**: Configure ad placements and networks (password protected)

## Recent Changes

- November 28, 2025: Initial clone from provided zip file
