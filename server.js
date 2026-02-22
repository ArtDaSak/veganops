const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { getToken } = require('next-auth/jwt');
const { google } = require('googleapis');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const tablerosMemoria = {};
const HARD_SUPER_ADMINS = ['dariencarvajal27@gmail.com', 'artdasak@gmail.com'];
const MASTER_REFRESH = process.env.DRIVE_MASTER_REFRESH_TOKEN;
const ALLOWED_ORIGINS = process.env.APP_ORIGIN ? process.env.APP_ORIGIN.split(',').map(s => s.trim()) : ['http://localhost:3000'];
const MAX_PAYLOAD_BYTES = 1_000_000; // ~1MB defensivo
const DEFAULT_CONFIG = { franquicias: [], usuarios: [], plantillasIngredientes: [], plantillasRecetas: [] };

function isSuperAdminEmail(email) {
  return !!email && HARD_SUPER_ADMINS.includes(email);
}

async function getDriveClient(token) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  if ((isSuperAdminEmail(token?.email) || token?.forceMaster) && MASTER_REFRESH) {
    oauth2Client.setCredentials({ refresh_token: MASTER_REFRESH });
  } else if (token?.accessToken) {
    oauth2Client.setCredentials({ access_token: token.accessToken });
  } else {
    throw new Error('Token de acceso ausente');
  }
  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function getFolderId(drive) {
  const res = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and name='Tableros VeganOps' and trashed=false",
    fields: 'files(id)'
  });
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;
  const folder = await drive.files.create({ requestBody: { name: 'Tableros VeganOps', mimeType: 'application/vnd.google-apps.folder' } });
  return folder.data.id;
}

async function loadConfig(drive, folderId) {
  const res = await drive.files.list({
    q: `mimeType='application/json' and name='veganops_global_config.json' and trashed=false and '${folderId}' in parents`,
    fields: 'files(id)'
  });
  let cfgId = res.data.files?.[0]?.id;
  if (!cfgId) {
    const created = await drive.files.create({
      requestBody: { name: 'veganops_global_config.json', mimeType: 'application/json', parents: [folderId] },
      media: { mimeType: 'application/json', body: JSON.stringify(DEFAULT_CONFIG) }
    });
    cfgId = created.data.id;
  }
  const cfgRaw = await drive.files.get({ fileId: cfgId, alt: 'media' });
  const configData = cfgRaw.data || { ...DEFAULT_CONFIG };
  HARD_SUPER_ADMINS.forEach((email, idx) => {
    const u = configData.usuarios?.find?.((x) => x.email === email);
    if (u) u.esAdminGlobal = true;
  });
  return configData;
}

const extractFid = (description) => {
  if (!description) return null;
  const match = description.match(/\[FID:([^\]]+)\]/);
  return match ? match[1] : null;
};

function userHasAccess(user, fid) {
  if (!fid) return false;
  if (user?.esAdminGlobal) return true;
  return user?.accesos?.some?.((a) => a.franquiciaId === fid);
}

function userCanEdit(user, fid) {
  if (!fid) return false;
  if (user?.esAdminGlobal) return true;
  return user?.accesos?.some?.((a) => a.franquiciaId === fid && (a.rol === 'Director' || a.rol === 'Coordinador'));
}

async function authorizeForBoard(token, tableroId) {
  const drive = await getDriveClient(token);
  const folderId = await getFolderId(drive);
  const meta = await drive.files.get({ fileId: tableroId, fields: 'id,description,parents' });
  const parents = meta.data.parents || [];
  if (!parents.includes(folderId)) throw new Error('Tablero fuera de carpeta');
  const fid = extractFid(meta.data.description);
  const config = await loadConfig(drive, folderId);
  const me = config.usuarios?.find?.((u) => u.email === token?.email);
  if (!me || !userHasAccess(me, fid)) throw new Error('Forbidden');
  return { drive, fid, me };
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  const io = new Server(server, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true
    },
    maxHttpBufferSize: MAX_PAYLOAD_BYTES
  });

  io.use(async (socket, next) => {
    try {
      const token = await getToken({ req: { headers: { cookie: socket.handshake.headers.cookie || '' } }, secret: process.env.NEXTAUTH_SECRET });
      if (!token?.email) return next(new Error('Unauthenticated'));
      socket.data.user = token;
      return next();
    } catch (e) {
      return next(e);
    }
  });

  io.on('connection', (socket) => {
    socket.on('unirse_tablero', async ({ tableroId, usuario }) => {
      try {
        await authorizeForBoard(socket.data.user, tableroId);
        socket.join(tableroId);
        const onlineCount = io.sockets.adapter.rooms.get(tableroId)?.size || 1;
        io.to(tableroId).emit('presencia', { usuario, accion: 'unido', onlineCount });
      } catch (e) {
        socket.emit('error', 'Acceso denegado');
        socket.disconnect(true);
      }
    });

    socket.on('actualizar_tablero', async ({ tableroId, data, versionCliente }) => {
      try {
        const payloadSize = Buffer.byteLength(JSON.stringify(data || {}));
        if (payloadSize > MAX_PAYLOAD_BYTES) {
          socket.emit('error', 'Payload demasiado grande');
          return;
        }

        const { me, fid } = await authorizeForBoard(socket.data.user, tableroId);
        if (!userCanEdit(me, fid)) {
          socket.emit('error', 'Sin permisos para modificar');
          return;
        }

        const dbTemp = tablerosMemoria[tableroId] || { version: data.version - 1 };
        
        if (versionCliente < dbTemp.version) {
          socket.emit('resincronizar', dbTemp.data); 
        } else {
          tablerosMemoria[tableroId] = { version: data.version, data };
          socket.to(tableroId).emit('tablero_actualizado', data);
        }
      } catch (e) {
        socket.emit('error', 'Acceso denegado');
      }
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) io.to(room).emit('presencia_salir', { id: socket.id });
      }
    });
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Servidor en tiempo real (Node+Next) listo en http://localhost:${port}`);
  });
});
