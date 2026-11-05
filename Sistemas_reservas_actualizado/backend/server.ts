import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import salasRouter from './routes/salas.ts';
import disponibilidadRouter from './routes/disponibilidad.ts';
import reservacionesRouter from './routes/reservaciones.ts';
import configuracionRouter from './routes/configuracion.ts';
import { inicializarBaseDeDatos } from './reservasService.ts';

export function crearAppBackend() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (req.path === '/api/index.php' && typeof req.query.__route === 'string') {
      const cleanRoute = req.query.__route.replace(/^\/+/, '');
      if (typeof req.query._method === 'string' && req.query._method) {
        req.method = req.query._method.toUpperCase();
      }
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(req.query)) {
        if (k !== '__route' && k !== '_method' && typeof v === 'string') {
          params.set(k, v);
        }
      }
      const qs = params.toString();
      req.url = `/api/${cleanRoute}${qs ? `?${qs}` : ''}`;
    }

    next();
  });

  app.use('/api/salas', salasRouter);
  app.use('/api/disponibilidad', disponibilidadRouter);
  app.use('/api/reservaciones', reservacionesRouter);
  app.use('/api', configuracionRouter);

  return app;
}

async function startServer() {
  await inicializarBaseDeDatos();

  const app = crearAppBackend();
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor MySQL ReservaEspacios funcionando en http://localhost:${PORT}`);
  });
}

startServer();
