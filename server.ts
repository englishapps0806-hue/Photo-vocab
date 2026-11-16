import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractVocabFromImage, GeminiServiceError } from './server/geminiVision.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'photo-vocab' });
  });

  app.post('/api/extract-vocab', async (req, res) => {
    try {
      const body = req.body as { imageBase64?: unknown; mimeType?: unknown } | undefined;
      if (
        !body ||
        typeof body.imageBase64 !== 'string' ||
        typeof body.mimeType !== 'string'
      ) {
        res.status(400).json({
          error: '画像データとMIMEタイプが必要です。',
          code: 'BAD_REQUEST',
        });
        return;
      }

      const result = await extractVocabFromImage(body.imageBase64, body.mimeType);
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof GeminiServiceError) {
        res.status(err.status).json({
          error: err.message,
          code: err.code,
        });
        return;
      }
      console.error('Unexpected /api/extract-vocab error:', err);
      res.status(500).json({
        error: 'サーバーで予期しないエラーが発生しました。もう一度お試しください。',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Photo Vocab server listening on http://0.0.0.0:${port}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
