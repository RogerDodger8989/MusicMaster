import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import apiRoutes from './api/routes';
import { initDatabase } from './database';
import { getEnrichmentCoverage, startEnrichmentWorker } from './services/enrichmentWorker';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize database
console.log('🔄 Initializing database...');
initDatabase();

// API Routes
app.use('/api', apiRoutes);

// Basic health check
app.get('/health', (req, res) => {
    try {
        const dbList = require('./database').getDatabase().prepare('PRAGMA database_list').all()
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            dbPathEnv: process.env.DB_PATH,
            cwd: process.cwd(),
            dbList: dbList
        });
    } catch (e: any) {
        res.json({ error: e.message })
    }
});

// Temporary endpoint to fix paths
app.get('/api/fix-paths', (req, res) => {
    try {
        const db = require('./database').getDatabase();
        const oldPath = process.env.OLD_MUSIC_PATH || 'C:\\\\Users\\\\denni\\\\Desktop\\\\Apps\\\\MusicMaster';
        const newPath = process.env.NEW_MUSIC_PATH || 'C:\\\\Users\\\\denni\\\\Desktop\\\\Egna appar\\\\MusicMaster';

        let changed = 0;
        const updates = [
            { t: 'albums', c: 'cover_art_path' },
            { t: 'albums_cache', c: 'cover_art_path' },
            { t: 'tracks', c: 'file_path' },
            { t: 'tracks', c: 'cover_art_path' },
            { t: 'artists', c: 'image_path' },
            { t: 'music_folders', c: 'path' }
        ];
        for (const u of updates) {
            try {
                const result = db.prepare(`UPDATE ${u.t} SET ${u.c} = REPLACE(${u.c}, ?, ?) WHERE ${u.c} LIKE ?`).run(oldPath, newPath, oldPath + '%');
                changed += result.changes;
            } catch (e) { }
        }
        res.json({ success: true, changed });
    } catch (e) {
        res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
    }
});

// Serve static files (cover art, etc) - to be configured
// app.use('/music', express.static(process.env.MUSIC_PATH || ''));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Last.fm API Key: ${process.env.LASTFM_API_KEY ? 'Present' : 'MISSING'}`);
    console.log(`Spotify Client ID: ${process.env.SPOTIFY_CLIENT_ID ? 'Present' : 'MISSING'}`);

    // Check enrichment coverage on startup and auto-start if needed
    setTimeout(() => {
        try {
            const coverage = getEnrichmentCoverage();
            console.log(`📊 Enrichment Coverage: ${coverage.enrichedTracks}/${coverage.totalTracks} tracks (${coverage.coveragePercentage}%)`);

            // Auto-start enrichment if coverage is less than 100%
            if (coverage.totalTracks > 0 && coverage.coveragePercentage < 100) {
                console.log('🚀 Coverage incomplete, starting automatic enrichment...');
                startEnrichmentWorker((progress) => {
                    console.log(`Enrichment: ${progress.enrichedTracks}/${progress.totalTracks} (${Math.round((progress.enrichedTracks / progress.totalTracks) * 100)}%)`);
                }).catch(error => {
                    console.error('Auto-enrichment failed:', error);
                });
            } else if (coverage.totalTracks > 0) {
                console.log('✅ All tracks already enriched!');
            }
        } catch (error) {
            console.error('Error checking enrichment coverage:', error);
        }
    }, 1000);

    // Start background tasks
    const { backgroundEnricher } = require('./services/enricher');
    backgroundEnricher.start(10000); // Process one album every 10 seconds

    const { syncWorker } = require('./services/syncWorker');
    syncWorker.start();
});
