'use client';
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import TableroView from "../TableroView";
import Modal from "../components/Modal";
import Image from "next/image";
import Link from "next/link";
import Swal from 'sweetalert2';

export default function Inicio() {
  const { data: session, status } = useSession();
  const [tableros, setTableros] = useState<any[]>([]);
  const [tableroActual, setTableroActual] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [franquicias, setFranquicias] = useState<any[]>([]);
  
  // UI states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [temaActual, setTemaActual] = useState('corcho-vegano');

  const [datosCargados, setDatosCargados] = useState(false);
  const [toast, setToast] = useState<{titulo: string, msj: string, tipo: 'info'|'error'|'success'} | null>(null);
  const [tableroABorrar, setTableroABorrar] = useState<string | null>(null);

  const mostrarToast = (titulo: string, msj: string, tipo: 'info'|'error'|'success' = 'info') => {
    setToast({ titulo, msj, tipo });
    setTimeout(() => setToast(null), 5000);
  };

  const autoGenRef = useRef(false);

  useEffect(() => {
    const temaGuardado = localStorage.getItem('veganops_tema');
    if (temaGuardado) {
      setTemaActual(temaGuardado);
      document.documentElement.setAttribute('data-tema', temaGuardado);
    }
    
    if (session) {
      const initLoad = Promise.all([cargarTableros(), cargarFranquicias()]).finally(() => {
        setDatosCargados(true);
      });
      // Fallback de seguridad si la red o las credenciales fallan, libera UI a los 6s
      setTimeout(() => setDatosCargados(true), 6000);
    }
  }, [session]);

  // useEffect(() => {
  //   if (franquicias.length > 0 && !autoGenRef.current) {
  //     autoGenRef.current = true;
  //     fetch('/api/drive', { method: 'POST', body: JSON.stringify({ action: 'auto-generate', franquicias }) })
  //       .then(res => res.json())
  //       .then(data => {
  //         if (data && data.generados > 0) {
  //           mostrarToast("Mes Inaugurado Automáticamente", `Tableros GTM copiados: ${data.generados}`, "success");
  //           cargarTableros();
  //         }
  //       }).catch(() => {});
  //   }
  // }, [franquicias]);

  const cargarFranquicias = async () => {
    try {
      const res = await fetch('/api/admin');
      if (res.ok) {
        const text = await res.text();
        try {
          const cfg = JSON.parse(text);
          setConfig(cfg);
          setFranquicias(cfg.franquicias || []);
        } catch(e) {
          setConfig(null);
          setFranquicias([]);
        }
      } else {
        setFranquicias([]);
      }
    } catch(e) { 
      setFranquicias([]);
    }
  };

  const cargarTableros = async () => {
    try {
      const res = await fetch('/api/drive?action=list');
      if (res.ok) {
        const text = await res.text();
        try {
          setTableros(JSON.parse(text));
        } catch(e) {
          setTableros([]);
        }
      } else {
        // En lugar de asustar al usuario con un error en pantalla (cuando usualmente es solo lag de Drive), mostramos info
        mostrarToast("Sincronización en curso", "Refrescando datos en segundo plano...", "info");
        if (tableros.length === 0) setTableros([]);
      }
    } catch(e) { 
      setTableros([]);
    }
  };

  const submitCrearTablero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim() || !nuevaDireccion) return; // Ahora nuevaDireccion guarda el ID de la franquicia
    
    // Obtenemos los datos de la franquicia real (para guardarlo en drive si es útil o simplemente el ID)
    const franqElegida = franquicias.find(f => f.id === nuevaDireccion);
    const mDescripcion = franqElegida ? `Pertenece a: ${franqElegida.nombre} [FID:${franqElegida.id}]` : '';

    const body = {
      action: 'create', name: nuevoNombre, description: mDescripcion,
      data: { 
        version: 1, 
        columnas: [
          { id: 'col-backlog', titulo: 'Backlog (Ideas / Por refinar)', orden: 0 },
          { id: 'col-todo', titulo: 'To Do (Por hacer)', orden: 1 },
          { id: 'col-inprogress', titulo: 'In Progress (En curso)', orden: 2 },
          { id: 'col-review', titulo: 'Review (Validación)', orden: 3 },
          { id: 'col-done', titulo: 'Done (Completado)', orden: 4 }
        ], 
        tarjetas: [
          { id: 'tar-1', columnaId: 'col-todo', titulo: 'Ejemplo de tarea Scrum', descripcion: 'Mueve esta tarea a In Progress', etiquetas: [], asignados: [], checklists: [], creadoPor: session?.user?.name || 'Sistema' }
        ], 
        insumos: [],
        recetas: [], 
        pedidos: [], 
        enlaces: [] 
      }
    };
    
    mostrarToast("Creando...", "Generando estructura en Drive...", "info");
    const res = await fetch('/api/drive', { method: 'POST', body: JSON.stringify(body) });
    
    setNuevoNombre('');
    setNuevaDireccion('');
    setIsModalOpen(false);
    
    if (res.ok) {
        mostrarToast("¡Tablero Creado!", "La operación fue exitosa. Puede tardar unos segundos en ser visible.", "success");
    } else {
        mostrarToast("Error", "No se pudo crear el tablero.", "error");
    }
    
    cargarTableros();
  };

  const duplicarTablero = async (id: string, name: string) => {
    mostrarToast("Duplicando...", "Clonando el tablero en Drive...", "info");
    const res = await fetch('/api/drive', { method: 'POST', body: JSON.stringify({ action: 'copy', id, name }) });
    if(res.ok) mostrarToast("¡Clonado!", "El tablero se ha duplicado con éxito.", "success");
    cargarTableros();
  };

  const borrarTablero = (id: string) => {
    setTableroABorrar(id);
  };

  const confirmarBorrado = async () => {
    if (!tableroABorrar) return;
    const id = tableroABorrar;
    setTableroABorrar(null);
    mostrarToast("Eliminando...", "Borrando archivo operativo...", "info");
    const res = await fetch('/api/drive', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) });
    if(res.ok) mostrarToast("Eliminado", "Se ha borrado el tablero.", "success");
    cargarTableros();
  };

  const eliminarFantasmas = async () => {
    const res = await Swal.fire({ title: '¿Limpiar Drive?', text: '¿Eliminar todos los tableros huérfanos generados por el sandbox de Google Drive?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, limpiar' });
    if (!res.isConfirmed) return;
    
    // Capturamos archivos sin ID de Franquicia O aquellos que traigan extensión pura .json en su UI (fantasma)
    const huerfanos = tableros.filter(t => !t.description || !t.description.includes('[FID:') || t.name.endsWith('.json'));
    if (huerfanos.length === 0) {
      mostrarToast("Todo Limpio", "No se detectaron tableros basura o huérfanos.", "success");
      return;
    }

    mostrarToast("Limpiando Drive...", `Borrando ${huerfanos.length} archivos basura...`, "info");
    
    // Bora en paralelo
    await Promise.all(huerfanos.map(t => 
       fetch('/api/drive', { method: 'POST', body: JSON.stringify({ action: 'delete', id: t.id }) }).catch(() => {})
    ));
    
    mostrarToast("Limpieza Completada", `Se eliminaron ${huerfanos.length} tableros huérfanos.`, "success");
    cargarTableros();
  };

  const alternarTema = () => {
    const nuevo = temaActual === 'corcho-vegano' ? 'noche-purpura' : 'corcho-vegano';
    setTemaActual(nuevo);
    localStorage.setItem('veganops_tema', nuevo);
    document.documentElement.setAttribute('data-tema', nuevo);
  };

  if (status === "loading" || (session && !datosCargados)) return <div className="min-h-screen flex items-center justify-center font-bold text-primary animate-pulse">Cargando Entorno Operacional...</div>;
  if (!session) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface p-8 rounded-lg shadow-2xl text-center max-w-sm border border-borderr">
        <div className="flex justify-center mb-6">
          {config?.logoBase64 ? (
            <img src={config.logoBase64} alt="VeganOps Custom Logo" className="w-[90px] h-[90px] object-contain drop-shadow-xl" />
          ) : (
            <Image src="/logo.png" alt="VeganOps Logo" width={90} height={90} className="drop-shadow-xl" />
          )}
        </div>
        <h1 className="text-4xl font-black text-primary mb-2 drop-shadow-md">VeganOps</h1>
        <p className="mb-8 text-text/80 font-medium">Tu ecosistema organizativo plant-based.</p>
        <button onClick={() => signIn('google')} className="w-full bg-primary text-white font-bold px-6 py-3 rounded-md shadow-lg hover:bg-opacity-90 transition-transform active:scale-95 flex justify-center items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Entrar con Google
        </button>
      </div>
    </div>
  );

  // --- LÓGICA DE RBAC MULTIRROL ---
  const miPerfil = config?.usuarios?.find((u: any) => u.email === session?.user?.email);
  const isSuperAdmin = miPerfil?.esAdminGlobal === true;
  
  // Helpers para checkear si un usuario puntual puede ver o editar una sucursal por su ID
  const tieneAccesoAFid = (fid: string) => isSuperAdmin || miPerfil?.accesos?.some((a: any) => a.franquiciaId === fid);
  const esCoordinadorDeFid = (fid: string) => isSuperAdmin || miPerfil?.accesos?.some((a: any) => a.franquiciaId === fid && (a.rol === 'Coordinador' || a.rol === 'Director'));
  const algunRolCreador = isSuperAdmin || miPerfil?.accesos?.some((a: any) => a.rol === 'Coordinador' || a.rol === 'Director');
  
  const franquiciasParaCrear = franquicias.filter(f => esCoordinadorDeFid(f.id));

  const obtenerFid = (desc: string) => {
    const match = desc?.match(/\[FID:(.+?)\]/);
    return match ? match[1] : null;
  };

  if (tableroActual) {
    const tableroData = tableros.find(t => t.id === tableroActual);
    const fidTablero = obtenerFid(tableroData?.description || '');
    
    let rolParaTablero = 'Trabajador';
    if (isSuperAdmin) {
       rolParaTablero = 'AdminGlobal';
    } else if (fidTablero) {
       const asignacion = miPerfil?.accesos?.find((a: any) => a.franquiciaId === fidTablero);
       if (asignacion) rolParaTablero = asignacion.rol;
    }

    return (
      <TableroView 
        tableroId={tableroActual} 
        usuario={session.user?.name || 'Anon'} 
        userRole={rolParaTablero}
        volver={() => setTableroActual(null)} 
      />
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="flex flex-col gap-4 md:gap-6 mb-8 bg-surface/80 dark:bg-surface/40 p-5 md:p-8 rounded-[2rem] shadow-xl shadow-accent/5 dark:shadow-accent/20 border border-borderr/50 dark:border-accent/20 backdrop-blur-md dark:backdrop-blur-2xl transition-all duration-300">
        {/* Top Bar: Back Button & Actions */}
        <div className="flex justify-between items-center w-full">
          <Link href="/" className="p-2 bg-background border border-borderr rounded-full hover:bg-border/50 hover:scale-105 transition-all w-10 h-10 flex items-center justify-center font-bold text-text shrink-0 shadow-sm" title="Regresar al Hub">
            &lt;
          </Link>
          <div className="flex items-center gap-2">
            <button 
              onClick={alternarTema} 
              title="Cambiar textura y tema"
              className="p-2 md:p-2.5 border border-borderr rounded-full bg-background text-text shadow-sm hover:scale-105 transition-transform"
            >
              {temaActual === 'corcho-vegano' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-5 md:h-5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-5 md:h-5"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              )}
            </button>
            <div className="flex items-center gap-2 bg-background border border-borderr pl-3 pr-1 py-1 md:py-1.5 rounded-full shadow-inner">
              <span className="font-semibold text-xs md:text-sm max-w-[100px] md:max-w-[140px] truncate">{session.user?.name}</span>
              <button onClick={() => signOut()} className="text-[10px] md:text-xs bg-accent text-white font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-full hover:bg-opacity-80 transition cursor-pointer z-10 relative">
                Cerrar
              </button>
            </div>
          </div>
        </div>
        {/* Bottom Bar: Title & Logo */}
        <div className="flex items-center gap-3 md:gap-5 w-full">
          {config?.logoBase64 ? (
            <img src={config.logoBase64} alt="VeganOps Custom Logo" className="w-[50px] h-[50px] md:w-[60px] md:h-[60px] object-contain drop-shadow-md shrink-0" />
          ) : (
            <Image src="/logo.png" alt="VeganOps Logo" width={50} height={50} className="drop-shadow-md shrink-0 md:w-[60px] md:h-[60px]" />
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent leading-tight">Operaciones Plant-Based</h1>
            <p className="text-xs md:text-sm text-text/60 font-medium mt-1">Ingresa a los tableros de tu sucursal 🌱</p>
          </div>
        </div>
      </header>

      <div className="mb-8 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full md:max-w-xl">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text/40 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Buscar franquicia por nombre o dirección..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-surface border-2 border-borderr pl-12 pr-4 py-3 md:py-4 rounded-xl font-bold text-text text-sm md:text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>
        
        {isSuperAdmin && (
          <button 
             onClick={eliminarFantasmas}
             title="Herramienta V8.6: Borra todos los tableros vacíos o sin Sucursal debido a desajustes del Sandbox de Google."
             className="shrink-0 bg-red-500/10 border-2 border-red-500/20 text-red-600 px-4 py-3 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-sm shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Limpiar Fantasmas
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {algunRolCreador && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="group relative overflow-hidden bg-background border-2 border-dashed border-primary/50 text-primary p-8 rounded-2xl flex flex-col items-center justify-center transition-all hover:border-primary hover:shadow-lg hover:-translate-y-1 min-h-[220px]"
          >
            <div className="bg-primary/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <span className="text-xl font-bold">Nuevo Tablero de Trabajo</span>
          </button>
        )}

        {tableros?.filter(t => {
           const fid = obtenerFid(t.description || '');
           // Si tiene un FID embebido pero el usuario NO tiene acceso (y no es admin global), ocultamos.
           if (fid && !tieneAccesoAFid(fid)) return false;
           // Si NO tiene FID y el usuario no es admin global, asumimos que es huérfano y solo lo ve el Admin global
           if (!fid && !isSuperAdmin) return false;

           const termino = busqueda.toLowerCase();
           return t.name.toLowerCase().includes(termino) || (t.description && t.description.toLowerCase().includes(termino));
        }).map(t => {
          const fidTablero = obtenerFid(t.description || '');
          const puedeEditarTablero = fidTablero ? esCoordinadorDeFid(fidTablero) : isSuperAdmin;
          
          return (
          <div 
            key={t.id} 
            onClick={() => setTableroActual(t.id)}
            className="bg-surface border border-borderr/80 p-0 rounded-2xl shadow-md relative group flex flex-col overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 min-h-[220px] cursor-pointer"
          >
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-black mb-2 leading-tight text-text truncate" title={t.name.replace('.veganops', '')}>
                  {t.name.replace('.veganops', '')}
                </h2>
                {t.description && t.description.includes('Pertenece a:') && (
                  <div className="flex items-start gap-2 text-sm text-text/70 mb-3 bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <svg className="flex-shrink-0 mt-0.5 text-primary" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    <span className="line-clamp-2 leading-tight font-bold">{t.description}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[10px] text-text/40 uppercase tracking-widest font-bold">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  {new Date().toLocaleDateString()}
                </div>
              </div>
              <div className="text-primary font-bold opacity-60 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-auto pt-4 border-t border-borderr/30">
                Gestión Operativa <span>→</span>
              </div>
            </div>
            
            <div className={`bg-background/80 backdrop-blur border-t border-borderr flex justify-between p-3 absolute bottom-[-100px] w-full ${puedeEditarTablero ? 'group-hover:bottom-0' : ''} transition-all`}>
              {puedeEditarTablero && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); duplicarTablero(t.id, t.name.replace('.veganops', '')); }} 
                    className="text-sm font-bold text-accent px-3 py-1 flex items-center gap-1 hover:bg-accent/10 rounded"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Clonar
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); borrarTablero(t.id); }} 
                    className="text-sm font-bold text-red-500 px-3 py-1 flex items-center gap-1 hover:bg-red-500/10 rounded"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg> Borrar
                  </button>
                </>
              )}
            </div>
          </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nuevo Tablero">
        <form onSubmit={submitCrearTablero} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-bold text-text/80 mb-2 uppercase tracking-wide">
              Nombre Operacional
            </label>
            <input 
              type="text" 
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Ej. Línea Fuego Miercoles" 
              className="w-full bg-background border-2 border-borderr p-3 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium text-text placeholder-text/30"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-text/80 mb-2 uppercase tracking-wide flex justify-between items-center">
              <span>Asignar a Franquicia</span>
              <a href="/admin" className="text-xs text-primary hover:underline font-bold normal-case">Gestionar Locales &rarr;</a>
            </label>
            <select 
              value={nuevaDireccion}
              onChange={(e) => setNuevaDireccion(e.target.value)}
              className="w-full bg-background border-2 border-borderr p-3 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium text-text cursor-pointer"
              required
            >
              <option value="" disabled>-- Selecciona el Local correspondiente --</option>
              {franquicias.map(f => (
                <option key={f.id} value={f.id}>{f.nombre} ({f.direccion})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="px-5 py-2.5 rounded-lg font-bold text-text/60 hover:bg-border/50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={!nuevoNombre.trim() || !nuevaDireccion}
              className="bg-primary text-white px-5 py-2.5 rounded-lg font-bold shadow-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Crear Tablero
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!tableroABorrar} onClose={() => setTableroABorrar(null)} title="Eliminar Tablero">
        <div className="flex flex-col gap-4">
          <p className="text-text/80 font-medium">¿Estás seguro de que deseas eliminar este tablero operativo permanentemente?</p>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setTableroABorrar(null)} className="px-5 py-2.5 rounded-lg font-bold text-text/60 hover:bg-border/50 transition-colors">Cancelar</button>
            <button onClick={confirmarBorrado} className="bg-red-500 text-white px-5 py-2.5 rounded-lg font-bold shadow-md hover:bg-opacity-90 transition-all">Sí, Eliminar</button>
          </div>
        </div>
      </Modal>

      {/* Sistema de Toasts */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl border flex items-start gap-3 max-w-sm animate-fade-in transition-all ${
          toast.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
          toast.tipo === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
          'bg-accent/10 border-accent/20 text-accent'
        }`}>
          <div className="mt-0.5">
            {toast.tipo === 'error' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>}
            {toast.tipo === 'success' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>}
            {toast.tipo === 'info' && <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>}
          </div>
          <div>
            <h4 className="font-bold text-sm leading-tight mb-1">{toast.titulo}</h4>
            <p className="text-xs opacity-80 leading-snug">{toast.msj}</p>
          </div>
          <button onClick={() => setToast(null)} className="ml-auto opacity-50 hover:opacity-100">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      )}
    </div>
  );
}
