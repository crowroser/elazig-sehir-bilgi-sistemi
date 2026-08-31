import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swaggerSpec.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Swagger UI API Dokümantasyonu
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Elazığ Şehir Bilgi Sistemi API Dokümantasyonu (Swagger)',
    customCss: `
      .swagger-ui .topbar { background-color: #0f172a; border-bottom: 2px solid #38bdf8; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #0284c7; }
    `
  })
);
app.get('/swagger', (req, res) => res.redirect('/api-docs'));

// OpenAPI JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Rotaları
app.use('/api', apiRouter);

// Frontend Statik Dosyaları (Production Build İçin)
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/api-docs')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send(`
        <html>
          <head><title>Elazığ Şehir Bilgi Sistemi API</title></head>
          <body style="font-family: system-ui; padding: 2rem; background: #0f172a; color: white;">
            <h1>🏙️ Elazığ Şehir Bilgi Sistemi API Sunucusu</h1>
            <p>API servisi <code>/api</code> altında çalışıyor.</p>
            <ul>
              <li><a style="color: #38bdf8;" href="/api-docs">/api-docs</a> - Swagger UI Dokümantasyonu</li>
              <li><a style="color: #38bdf8;" href="/api/health">/api/health</a> - Sistem Durumu</li>
              <li><a style="color: #38bdf8;" href="/api/bus/stations">/api/bus/stations</a> - Otobüs Durakları</li>
              <li><a style="color: #38bdf8;" href="/api/cbs/emergency-assembly">/api/cbs/emergency-assembly</a> - Acil Toplanma Alanları</li>
            </ul>
          </body>
        </html>
      `);
    }
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Elazığ Şehir Bilgi Sistemi Sunucusu Başlatıldı!`);
  console.log(`🌐 Port: http://localhost:${PORT}`);
  console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`🚍 Canlı Otobüs API & 🏛️ CBS Servisleri Hazır`);
  console.log(`=======================================================`);
});
