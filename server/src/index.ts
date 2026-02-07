import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import apiRoutes from './api/routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Basic health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files (cover art, etc) - to be configured
// app.use('/music', express.static(process.env.MUSIC_PATH || ''));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Last.fm API Key: ${process.env.LASTFM_API_KEY ? 'Present' : 'MISSING'}`);
    console.log(`Spotify Client ID: ${process.env.SPOTIFY_CLIENT_ID ? 'Present' : 'MISSING'}`);
});

