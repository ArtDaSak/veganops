import { google } from 'googleapis';
import { getServerSession } from "next-auth/next";
import { opcionesAuth } from "@/lib/auth";
import { NextResponse } from 'next/server';

const HARD_SUPER_ADMINS = ['dariencarvajal27@gmail.com', 'artdasak@gmail.com'];
const MASTER_REFRESH = process.env.DRIVE_MASTER_REFRESH_TOKEN;
const DEFAULT_CONFIG = { franquicias: [], usuarios: [], plantillasIngredientes: [], plantillasRecetas: [] };

function isSuperAdminEmail(email?: string | null) {
  return !!email && HARD_SUPER_ADMINS.includes(email);
}

async function getDriveClient(session: any, forceMaster = false) {
  if (!session?.accessToken) throw new Error('No autorizado');
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

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
  
  const folder = await drive.files.create({ requestBody: { name: 'Tableros VeganOps', mimeType: 'application/vnd.google-apps.folder' } });
  return folder.data.id;
}

async function loadConfig(drive: any, folderId?: string) {
  const fId = folderId || await getFolderId(drive);
  const res = await drive.files.list({
    q: `mimeType='application/json' and name='veganops_global_config.json' and trashed=false and '${fId}' in parents`,
    fields: 'files(id)'
  });
  let cfgId = res.data.files?.[0]?.id;
  if (!cfgId) {
    const created = await drive.files.create({
      requestBody: { name: 'veganops_global_config.json', mimeType: 'application/json', parents: [fId] },
      media: { mimeType: 'application/json', body: JSON.stringify(DEFAULT_CONFIG) }
    });
    cfgId = created.data.id as string;
  }

  const cfgRaw = await drive.files.get({ fileId: cfgId, alt: 'media' });
  const configData: any = cfgRaw.data || { ...DEFAULT_CONFIG };
  if (!configData.franquicias) configData.franquicias = [];
  if (!configData.usuarios) configData.usuarios = [];

  HARD_SUPER_ADMINS.forEach((email, idx) => {
    const exists = configData.usuarios.find((u: any) => u.email === email);
    if (exists) {
      exists.esAdminGlobal = true;
    } else {
      configData.usuarios.push({ id: `admin-hardcoded-${idx}`, email, esAdminGlobal: true, accesos: [] });
    }
  });

  return { configData, cfgId: cfgId, folderId: fId };
}

const extractFid = (description?: string | null) => {
  if (!description) return null;
  const match = description.match(/\[FID:([^\]]+)\]/);
  return match ? match[1] : null;
};

function userHasAccess(user: any, fid: string | null) {
  if (!fid) return false;
  if (user?.esAdminGlobal) return true;
  return user?.accesos?.some((a: any) => a.franquiciaId === fid);
}

function userCanEdit(user: any, fid: string | null) {
  if (!fid) return false;
  if (user?.esAdminGlobal) return true;
  return user?.accesos?.some((a: any) => a.franquiciaId === fid && (a.rol === 'Director' || a.rol === 'Coordinador'));
}

// V8: Recupera las plantillas dictadas por la Central para inyectar en Tableros Nuevos
async function getGlobalTemplates(drive: any) {
  try {
    const folderId = await getFolderId(drive);
    const res = await drive.files.list({
      q: `mimeType='application/json' and name='veganops_global_config.json' and trashed=false and '${folderId}' in parents`,
      fields: 'files(id)'
    });
    if (res.data.files && res.data.files.length > 0) {
      const gFile = await drive.files.get({ fileId: res.data.files[0].id, alt: 'media' });
      const config: any = gFile.data;
      return { 
        insumos: config?.plantillasIngredientes || [], 
        recetas: config?.plantillasRecetas || [] 
      };
    }
  } catch(e) { console.error("Error leyendo templates globales en drive api", e) }
  return { insumos: [], recetas: [] };
}

export async function GET(req: Request) {
  try {
    const session: any = await getServerSession(opcionesAuth);
    const drive = await getDriveClient(session, true); // Master token se usa solo tras validar RBAC
    const { configData, folderId } = await loadConfig(drive);

    const me = configData.usuarios.find((u: any) => u.email === session?.user?.email);
    if (!me) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'list') {
      const res = await drive.files.list({
        q: `mimeType='application/json' and name contains '.veganops' and name != 'veganops_global_config.json' and trashed=false and '${folderId}' in parents`,
        fields: 'files(id, name, description, owners, capabilities, parents)'
      });
      const files = (res.data.files || []).filter(f => {
        const fid = extractFid(f.description);
        return me.esAdminGlobal ? true : userHasAccess(me, fid);
      });
      return NextResponse.json(files);
    }

    if (action === 'get') {
      const id = url.searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

      const meta = await drive.files.get({ fileId: id, fields: 'id,description,parents' });
      const parents: string[] = meta.data.parents || [];
      if (!parents.includes(folderId)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

      const fid = extractFid(meta.data.description);
      if (!userHasAccess(me, fid)) return NextResponse.json({ error: 'Sin permisos para este tablero' }, { status: 403 });

      const res = await drive.files.get({ fileId: id as string, alt: 'media' });
      let data = res.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) { console.error("Error parseando contenido de tablero", e); data = {}; }
      }
      return NextResponse.json(data);
    }

    return NextResponse.json({error: 'Acción no válida'}, {status: 400});
  } catch(e) { return NextResponse.json({error: String(e)}, {status: 500}); }
}

export async function POST(req: Request) {
  try {
    const session: any = await getServerSession(opcionesAuth);
    const drive = await getDriveClient(session, true);
    const { configData, folderId } = await loadConfig(drive);
    const body = await req.json();
    const { action, id, data, name, description } = body;

    const me = configData.usuarios.find((u: any) => u.email === session?.user?.email);
    if (!me) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    if (action === 'create') {
      const fid = extractFid(description);
      if (!fid) return NextResponse.json({ error: 'Descripción debe incluir [FID:<id>]' }, { status: 400 });
      if (!userCanEdit(me, fid)) return NextResponse.json({ error: 'Sin permisos para crear en esta franquicia' }, { status: 403 });

      const sanitizedName = name.replace(/\.json$/i, '').trim();
      const templates = await getGlobalTemplates(drive);
      if (data) {
        data.insumos = templates.insumos;
        data.recetas = templates.recetas;
      }

      const res = await drive.files.create({
        requestBody: { name: sanitizedName + '.veganops', description: description || '', mimeType: 'application/json', parents: [folderId as string] },
        media: { mimeType: 'application/json', body: JSON.stringify(data) }
      });
      return NextResponse.json(res.data);
    }

    if (action === 'update') {
      const meta = await drive.files.get({ fileId: id, fields: 'id,description,parents' });
      const parents: string[] = meta.data.parents || [];
      if (!parents.includes(folderId)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      const fid = extractFid(meta.data.description);
      if (!fid && !me.esAdminGlobal) return NextResponse.json({ error: 'Tablero sin FID asignado' }, { status: 403 });
      if (fid && !userCanEdit(me, fid)) return NextResponse.json({ error: 'Sin permisos para editar este tablero' }, { status: 403 });

      const res = await drive.files.update({
        fileId: id, media: { mimeType: 'application/json', body: JSON.stringify(data) }
      });
      return NextResponse.json(res.data);
    }

    if (action === 'copy') {
      const meta = await drive.files.get({ fileId: id, fields: 'id,description,parents' });
      const parents: string[] = meta.data.parents || [];
      if (!parents.includes(folderId)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      const fid = extractFid(meta.data.description);
      if (!fid && !me.esAdminGlobal) return NextResponse.json({ error: 'Tablero sin FID asignado' }, { status: 403 });
      if (fid && !userCanEdit(me, fid)) return NextResponse.json({ error: 'Sin permisos para clonar este tablero' }, { status: 403 });

      const res = await drive.files.copy({
        fileId: id, requestBody: { name: name + ' (Copiado).veganops', description: meta.data.description, parents: meta.data.parents }
      });
      return NextResponse.json(res.data);
    }

    if (action === 'delete') {
      const meta = await drive.files.get({ fileId: id, fields: 'id,description,parents' });
      const parents: string[] = meta.data.parents || [];
      if (!parents.includes(folderId)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      const fid = extractFid(meta.data.description);
      if (!fid && !me.esAdminGlobal) return NextResponse.json({ error: 'Tablero sin FID asignado' }, { status: 403 });
      if (fid && !userCanEdit(me, fid)) return NextResponse.json({ error: 'Sin permisos para eliminar este tablero' }, { status: 403 });

      await drive.files.delete({ fileId: id });
      return NextResponse.json({ success: true, deleted: id });
    }
    
    // --- MOTOR DE AUTO-GENERACIÓN INTER-MENSUAL (GTM) ---
    if (action === 'auto-generate') {
      if (!me.esAdminGlobal) return NextResponse.json({ error: 'Solo Admin Global' }, { status: 403 });
      const { franquicias } = body;
      if (!franquicias || !Array.isArray(franquicias)) throw new Error('Faltan franquicias');
      
      const nowGTM = new Date();
      
      const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      const mesActualStr = `${meses[nowGTM.getUTCMonth()]} ${nowGTM.getUTCFullYear()}`;
      
      // 1. Obtener todos los tableros existentes
      const resList = await drive.files.list({
        q: `mimeType='application/json' and name contains '.veganops' and trashed=false and '${folderId}' in parents`,
        fields: 'files(id, name, description, createdTime, parents)'
      });
      const todosTableros = resList.data.files || [];
      
      let creados = 0;
      
      // 2. Iterar por cada Franquicia Global
      for (const reqFranq of franquicias) {
        const tabsFranq = todosTableros.filter(t => t.description && t.description.includes(`[FID:${reqFranq.id}]`));
        
        const yaExisteEsteMesGTM = tabsFranq.some(t => {
           if (!t.createdTime) return false;
           const d = new Date(t.createdTime as string);
           return d.getUTCMonth() === nowGTM.getUTCMonth() && d.getUTCFullYear() === nowGTM.getUTCFullYear();
        });

        if (yaExisteEsteMesGTM) continue;
        
        let dataBase: any = null;
        if (tabsFranq.length > 0) {
          const ultimoTab = tabsFranq.sort((a, b) => new Date(b.createdTime as string).getTime() - new Date(a.createdTime as string).getTime())[0];
          try {
            const fileData = await drive.files.get({ fileId: ultimoTab.id as string, alt: 'media' });
            dataBase = typeof fileData.data === 'string' ? JSON.parse(fileData.data) : fileData.data;
          } catch(e) { console.error("Error leyendo tablero base", e); }
        }
        
        let nuevaData: any;
        if (dataBase) {
           const colDoneMatch = dataBase.columnas?.find((c: any) => c.titulo.toLowerCase().includes('done') || c.titulo.toLowerCase().includes('completado'));
           const doneId = colDoneMatch ? colDoneMatch.id : 'col-done';
           
           nuevaData = { ...dataBase };
           if (nuevaData.tarjetas) {
              nuevaData.tarjetas = nuevaData.tarjetas.filter((tar: any) => tar.columnaId !== doneId);
           }
        } else {
           const macros = await getGlobalTemplates(drive);
           nuevaData = {
              version: 1, 
              columnas: [
                { id: 'col-backlog', titulo: 'Backlog (Ideas / Por refinar)', orden: 0 },
                { id: 'col-todo', titulo: 'To Do (Por hacer)', orden: 1 },
                { id: 'col-inprogress', titulo: 'In Progress (En curso)', orden: 2 },
                { id: 'col-review', titulo: 'Review (Validación)', orden: 3 },
                { id: 'col-done', titulo: 'Done (Completado)', orden: 4 }
              ], 
              tarjetas: [], insumos: macros.insumos, recetas: macros.recetas, pedidos: [], enlaces: []
           };
        }
        
        const nombreFinal = `Operaciones - ${reqFranq.nombre} - [${mesActualStr}]`;
        await drive.files.create({
          requestBody: { 
             name: nombreFinal + '.veganops', 
             description: `[FID:${reqFranq.id}] Tablero Auto-Generado.`, 
             mimeType: 'application/json', 
             parents: [folderId as string] 
          },
          media: { mimeType: 'application/json', body: JSON.stringify(nuevaData) }
        });
        creados++;
      }
      
      return NextResponse.json({ success: true, generados: creados });
    }

    return NextResponse.json({error: 'Acción no válida'}, {status: 400});
  } catch(e) { return NextResponse.json({error: String(e)}, {status: 500}); }
}
