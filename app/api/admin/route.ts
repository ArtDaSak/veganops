import { google } from 'googleapis';
import { getServerSession } from "next-auth/next";
import { opcionesAuth } from "@/lib/auth";
import { NextResponse } from 'next/server';

const CONFIG_FILE_NAME = 'veganops_global_config.json';
const DEFAULT_CONFIG = {
  franquicias: [],
  usuarios: [],
  plantillasIngredientes: [],
  plantillasRecetas: []
}; // Estructura V5.5: { id, email, esAdminGlobal: boolean, accesos: [{ franquiciaId, rol }] }

const HARD_SUPER_ADMINS = ['dariencarvajal27@gmail.com', 'artdasak@gmail.com'];
const MASTER_REFRESH = process.env.DRIVE_MASTER_REFRESH_TOKEN;

function isSuperAdminEmail(email?: string | null) {
  return !!email && HARD_SUPER_ADMINS.includes(email);
}

async function getDriveClient(session: any, forceMaster = false) {
  if (!session?.accessToken) throw new Error('No autorizado');

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  // Usar el refresh token maestro solo para super admins o tareas privilegiadas
  if ((forceMaster || isSuperAdminEmail(session?.user?.email)) && MASTER_REFRESH) {
    oauth2Client.setCredentials({ refresh_token: MASTER_REFRESH });
  } else {
    oauth2Client.setCredentials({ access_token: session.accessToken });
  }

  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function getFolderId(drive: any) {
  let res = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and name='Tableros VeganOps' and trashed=false",
    fields: 'files(id)'
  });
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;
  
  // V8.5: Si no es dueño, también buscar en carpetas que le han compartido
  res = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and name='Tableros VeganOps' and sharedWithMe=true and trashed=false",
    fields: 'files(id)'
  });
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;
  
  // Creates folder if it doesn't exist
  const folder = await drive.files.create({ 
      requestBody: { name: 'Tableros VeganOps', mimeType: 'application/vnd.google-apps.folder' } 
  });
  return folder.data.id;
}

// Function to find or create the global config file
async function getOrCreateConfigFile(drive: any, folderId: string) {
  const res = await drive.files.list({
    q: `mimeType='application/json' and name='${CONFIG_FILE_NAME}' and trashed=false`,
    fields: 'files(id)'
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  // Create the config file if it doesn't exist
  const newFile = await drive.files.create({
    requestBody: { 
        name: CONFIG_FILE_NAME, 
        mimeType: 'application/json', 
        parents: [folderId] 
    },
    media: { 
        mimeType: 'application/json', 
        body: JSON.stringify(DEFAULT_CONFIG) 
    }
  });
  
  return newFile.data.id;
}

async function loadConfig(drive: any) {
  const folderId = await getFolderId(drive);
  const fileId = await getOrCreateConfigFile(drive, folderId);
  const res = await drive.files.get({ fileId, alt: 'media' });

  const configData: any = res.data || DEFAULT_CONFIG;
  if (!configData.franquicias) configData.franquicias = [];
  if (!configData.usuarios) configData.usuarios = [];
  if (!configData.plantillasIngredientes) configData.plantillasIngredientes = [];
  if (!configData.plantillasRecetas) configData.plantillasRecetas = [];

  // Bootstrap super admins garantizados
  const hardcodedAdmins = HARD_SUPER_ADMINS;
  configData.usuarios = configData.usuarios.map((u: any) => {
    if (hardcodedAdmins.includes(u.email)) return { ...u, esAdminGlobal: true };
    return u;
  });
  hardcodedAdmins.forEach((email, idx) => {
    if (!configData.usuarios.some((u: any) => u.email === email)) {
      configData.usuarios.push({
        id: `admin-hardcoded-${idx}`,
        email,
        esAdminGlobal: true,
        accesos: []
      });
    }
  });

  return { configData, fileId, folderId };
}

export async function GET(req: Request) {
  try {
    const session: any = await getServerSession(opcionesAuth);
    const drive = await getDriveClient(session);
    const { configData } = await loadConfig(drive);

    const me = configData.usuarios.find((u: any) => u.email === session?.user?.email);
    if (!me) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    // Respuesta minimizada para no admins: solo sus franquicias y su propio usuario
    if (me.esAdminGlobal) {
      return NextResponse.json(configData);
    }

    const visibles = me.accesos?.map((a: any) => a.franquiciaId) || [];
    const franquicias = configData.franquicias.filter((f: any) => visibles.includes(f.id));
    const sanitizado = {
      ...configData,
      franquicias,
      usuarios: [me],
    };
    return NextResponse.json(sanitizado);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session: any = await getServerSession(opcionesAuth);
    const drive = await getDriveClient(session, true);
    const { configData, fileId, folderId } = await loadConfig(drive);

    const me = configData.usuarios.find((u: any) => u.email === session?.user?.email);
    if (!me || !me.esAdminGlobal) return NextResponse.json({ error: 'Solo Admin Global puede modificar' }, { status: 403 });

    const body = await req.json();

    // Validación de seguridad (máx 2 directores por franquicia)
    if (body?.usuarios) {
      const directorCounts: Record<string, number> = {};
      for (const u of body.usuarios) {
        if (!u.esAdminGlobal && u.accesos) {
          for (const acc of u.accesos) {
            if (acc.rol === 'Director') {
              directorCounts[acc.franquiciaId] = (directorCounts[acc.franquiciaId] || 0) + 1;
              if (directorCounts[acc.franquiciaId] > 2) {
                return NextResponse.json({ error: "Límite de seguridad: Una tienda no puede tener más de 2 Directores." }, { status: 400 });
              }
            }
          }
        }
      }
    }

    // Save the new config
    const res = await drive.files.update({
      fileId,
      media: { mimeType: 'application/json', body: JSON.stringify(body) }
    });

    // Compartir carpeta con nuevos usuarios
    if (body.usuarios && Array.isArray(body.usuarios)) {
      await Promise.all(body.usuarios.map((u: any) => {
        if (!u.email) return Promise.resolve();
        return drive.permissions.create({
          fileId: folderId,
          requestBody: { type: 'user', role: 'writer', emailAddress: u.email },
          sendNotificationEmail: false
        }).catch((err: any) => {
          console.error("Error compartiendo con", u.email, err.message);
        });
      }));
    }

    return NextResponse.json({ success: true, updatedConfig: res.data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
