'use client';
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Modal from "../components/Modal";
import Swal from 'sweetalert2';

interface Franquicia {
  id: string;
  nombre: string;
  direccion: string;
  status: 'activa' | 'inactiva';
}

interface UsuarioAcceso {
  franquiciaId: string;
  rol: 'Director' | 'Coordinador' | 'Trabajador';
}

interface UsuarioRol {
  id: string;
  email: string;
  esAdminGlobal: boolean;
  accesos: UsuarioAcceso[];
}

interface GlobalConfig {
  franquicias: Franquicia[];
  usuarios: UsuarioRol[];
  plantillasIngredientes?: any[];
  plantillasRecetas?: any[];
  logoBase64?: string;
}

export default function AdminPanel() {
  const { data: session, status } = useSession();
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'franquicias' | 'usuarios' | 'plantillas'>('franquicias');
  
  // Responsive: Overflow wrap on tables and hide columns on mobile if necessary
  // Force activeTab to 'usuarios' if Director enters the panel (fixes blank screen bug)
  useEffect(() => {
    if (config && session) {
      const p = config.usuarios.find((u: any) => u.email === session.user?.email);
      if (p && !p.esAdminGlobal && activeTab === 'franquicias') {
        setActiveTab('usuarios');
      }
    }
  }, [config, session, activeTab]);

  const [toast, setToast] = useState<{titulo: string, msj: string, tipo: 'info'|'error'|'success'} | null>(null);
  const mostrarToast = (titulo: string, msj: string, tipo: 'info'|'error'|'success' = 'info') => {
    setToast({ titulo, msj, tipo });
    setTimeout(() => setToast(null), 5000);
  };

  // UI Modals
  const [isFranqModalOpen, setIsFranqModalOpen] = useState(false);
  const [franqEditId, setFranqEditId] = useState<string | null>(null);
  const [fNombre, setFNombre] = useState('');
  const [fDireccion, setFDireccion] = useState('');

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userEditId, setUserEditId] = useState<string | null>(null);
  const [uEmail, setUEmail] = useState('');
  const [uEsAdminGlobal, setUEsAdminGlobal] = useState(false);
  const [uAccesos, setUAccesos] = useState<UsuarioAcceso[]>([]);

  const [franqABorrar, setFranqABorrar] = useState<string | null>(null);
  const [userABorrar, setUserABorrar] = useState<string | null>(null);

  // Filtros Avanzados (V8)
  const [uBusqueda, setUBusqueda] = useState('');
  const [uFiltroRol, setUFiltroRol] = useState('Todos');
  const [uFiltroFranq, setUFiltroFranq] = useState('Todas');

  // Estados Plantillas V8
  const [isModalInsumoOpen, setIsModalInsumoOpen] = useState(false);
  const [insumoEditId, setInsumoEditId] = useState<string | null>(null);
  const [ibNombre, setIBNombre] = useState('');
  const [ibUnidad, setIBUnidad] = useState('g');

  const [isModalRecetaOpen, setIsModalRecetaOpen] = useState(false);
  const [recetaEditId, setRecetaEditId] = useState<string | null>(null);
  const [rbNombre, setRBNombre] = useState('');
  const [rbIngredientes, setRBIngredientes] = useState<{ insumoId: string, cantidad: number }[]>([]);
  const [rbPasos, setRBPasos] = useState<string[]>([]);
  const [rbPasoTemp, setRbPasoTemp] = useState('');
  const [rbTempSubId, setRbTempSubId] = useState('');
  const [rbTempSubCant, setRbTempSubCant] = useState('100');

  const guardarInsumoGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!config || !ibNombre.trim()) return;
    
    let nuevos = [...(config.plantillasIngredientes || [])];
    if (insumoEditId) {
       nuevos = nuevos.map(i => i.id === insumoEditId ? { ...i, nombre: ibNombre, unidad: ibUnidad } : i);
    } else {
       nuevos.push({ id: Date.now().toString(), nombre: ibNombre, unidad: ibUnidad, esCompuesto: false, creadoPor: session?.user?.name || 'Admin', subInsumos: [] });
    }
    
    const nuevoConfig = { ...config, plantillasIngredientes: nuevos };
    setConfig(nuevoConfig);
    setIsModalInsumoOpen(false);
    
    mostrarToast("Guardando...", "Actualizando insumos base en Drive", "info");
    const res = await fetch('/api/admin', { method: 'POST', body: JSON.stringify(nuevoConfig) });
    if(res.ok) mostrarToast("Éxito", "Insumo base corporativo guardado", "success");
  };

  const sincronizarNube = async () => {
    if(!config) return;
    mostrarToast("Sincronizando Nube...", "Aplicando permisos de Google Drive a todo el personal. Esto puede tardar unos segundos.", "info");
    const res = await fetch('/api/admin', { method: 'POST', body: JSON.stringify(config) });
    if(res.ok) {
       mostrarToast("¡Nube Sincronizada!", "Todos los Empleados ahora tienen acceso a sus tableros heredados.", "success");
    } else {
       mostrarToast("Error", "No se pudieron inyectar los permisos de nube a todos los correos.", "error");
    }
  };

  const eliminarInsumoGlobal = async (id: string) => {
    if(!config) return;
    const alert = await Swal.fire({ title: '¿Eliminar insumo base?', text: "Esto afectará futuras plantillas.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' });
    if (!alert.isConfirmed) return;
    const nuevoConfig = { ...config, plantillasIngredientes: (config.plantillasIngredientes||[]).filter(i => i.id !== id) };
    setConfig(nuevoConfig);
    const res = await fetch('/api/admin', { method: 'POST', body: JSON.stringify(nuevoConfig) });
    if(res.ok) mostrarToast("Eliminado", "Insumo base removido", "success");
  };

  const guardarRecetaGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!config || !rbNombre.trim()) return;
    
    let nuevos = [...(config.plantillasRecetas || [])];
    if (recetaEditId) {
       nuevos = nuevos.map(r => r.id === recetaEditId ? { ...r, nombre: rbNombre, ingredientes: rbIngredientes, pasos: rbPasos } : r);
    } else {
       nuevos.push({ id: Date.now().toString(), nombre: rbNombre, ingredientes: rbIngredientes, pasos: rbPasos, notas: '', creadoPor: session?.user?.name || 'Admin' });
    }
    
    const nuevoConfig = { ...config, plantillasRecetas: nuevos };
    setConfig(nuevoConfig);
    setIsModalRecetaOpen(false);
    
    mostrarToast("Guardando...", "Actualizando recetas base en Drive", "info");
    const res = await fetch('/api/admin', { method: 'POST', body: JSON.stringify(nuevoConfig) });
    if(res.ok) mostrarToast("Éxito", "Receta base corporativa guardada", "success");
  };

  const eliminarRecetaGlobal = async (id: string) => {
    if(!config) return;
    const alert = await Swal.fire({ title: '¿Eliminar receta base?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar' });
    if (!alert.isConfirmed) return;
    const nuevoConfig = { ...config, plantillasRecetas: (config.plantillasRecetas||[]).filter(r => r.id !== id) };
    setConfig(nuevoConfig);
    const res = await fetch('/api/admin', { method: 'POST', body: JSON.stringify(nuevoConfig) });
    if(res.ok) mostrarToast("Eliminado", "Receta base removida", "success");
  };

  const abrirModalInsumo = (insumo?: any) => {
    if (insumo) {
      setInsumoEditId(insumo.id);
      setIBNombre(insumo.nombre);
      setIBUnidad(insumo.unidad);
    } else {
      setInsumoEditId(null);
      setIBNombre('');
      setIBUnidad('g');
    }
    setIsModalInsumoOpen(true);
  };

  const abrirModalReceta = (receta?: any) => {
    if (receta) {
      setRecetaEditId(receta.id);
      setRBNombre(receta.nombre);
      setRBIngredientes(receta.ingredientes || []);
      setRBPasos(receta.pasos || []);
    } else {
      setRecetaEditId(null);
      setRBNombre('');
      setRBIngredientes([]);
      setRBPasos([]);
    }
    setRbPasoTemp('');
    setRbTempSubId('');
    setRbTempSubCant('100');
    setIsModalRecetaOpen(true);
  };

  useEffect(() => {
    if (session) cargarConfig();
  }, [session]);

  const cargarConfig = async () => {
    try {
      const res = await fetch('/api/admin');
      if (res.ok) {
        setConfig(await res.json());
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Error desconocido al cargar Admin');
      }
    } catch(e: any) { 
        mostrarToast("Acceso Restringido", "No se pudo cargar la configuración de administrador global. Comprueba tu nivel de acceso.", "error");
        setConfig({ franquicias: [], usuarios: [] });
    }
  };

  const guardarConfig = async (newConfig: GlobalConfig) => {
    setConfig(newConfig); // Optimistic UI
    await fetch('/api/admin', { method: 'POST', body: JSON.stringify(newConfig) });
  };

  const handleSubirLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      mostrarToast("Aviso", "El logotipo excede los 2MB limitados de la Nube.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result as string;
      if (!config) return;
      const newConfig = { ...config, logoBase64: b64 };
      guardarConfig(newConfig);
      mostrarToast("Logo Actualizado", "El nuevo identificador fue inyectado globalmente.", "success");
    };
    reader.readAsDataURL(file);
  };

  // ---- Lógica Franquicias ----
  const abrirModalFranq = (f?: Franquicia) => {
    if (f) {
      setFranqEditId(f.id);
      setFNombre(f.nombre);
      setFDireccion(f.direccion);
    } else {
      setFranqEditId(null);
      setFNombre('');
      setFDireccion('');
    }
    setIsFranqModalOpen(true);
  };

  const guardarFranquicia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !fNombre.trim()) return;

    let nuevasF = [...config.franquicias];
    let nuevosU = [...config.usuarios];
    
    if (franqEditId) {
      nuevasF = nuevasF.map(f => f.id === franqEditId ? { ...f, nombre: fNombre, direccion: fDireccion } : f);
    } else {
      const nuevoId = Date.now().toString();
      nuevasF.push({ id: nuevoId, nombre: fNombre, direccion: fDireccion, status: 'activa' });
      
      // Auto-asignación de Coordinador al creador activo si no es AdminGlobal para que no pierda acceso.
      const miEmail = session?.user?.email;
      if (miEmail) {
        nuevosU = nuevosU.map(u => {
          if (u.email === miEmail && !u.esAdminGlobal) {
            return {
              ...u,
              accesos: [...(u.accesos || []), { franquiciaId: nuevoId, rol: 'Coordinador' as const }]
            };
          }
          return u;
        });
      }

      // Auto-generar primer tablero basal en Google Drive.
      try {
        await fetch('/api/drive', {
          method: 'POST',
          body: JSON.stringify({ action: 'create', name: `Tablero Operativo - ${fNombre}`, description: `[FID:${nuevoId}] Tablero Auto-Generado de nueva tienda.` })
        });
        mostrarToast("Sede Lista", `Tablero Operativo y Tienda creados con éxito.`, "success");
      } catch (e) {
        console.error("Error autocreando tablero de sucursal", e);
      }
    }
    
    guardarConfig({ franquicias: nuevasF, usuarios: nuevosU });
    setIsFranqModalOpen(false);
  };

  const intentarEliminarFranquicia = (id: string) => {
    setFranqABorrar(id);
  };

  const confirmarEliminarFranquicia = () => {
    if (!config || !franqABorrar) return;
    const id = franqABorrar;
    const nuevasF = config.franquicias.filter(f => f.id !== id);
    
    // Desvincular usuarios que tengan acceso a la franquicia eliminada
    const nuevosU = config.usuarios.map(u => ({
      ...u,
      accesos: (u.accesos || []).filter(acc => acc.franquiciaId !== id)
    }));
    
    guardarConfig({ franquicias: nuevasF, usuarios: nuevosU });
    setFranqABorrar(null);
    mostrarToast("Franquicia Eliminada", "Se desvincularon los usuarios asociados.", "success");
  };

  // ---- Lógica Usuarios ----
  const abrirModalUser = (u?: UsuarioRol) => {
    if (u) {
      setUserEditId(u.id);
      setUEmail(u.email);
      setUEsAdminGlobal(u.esAdminGlobal || false);
      setUAccesos(u.accesos || []);
    } else {
      setUserEditId(null);
      setUEmail('');
      setUEsAdminGlobal(false);
      setUAccesos([]);
    }
    setIsUserModalOpen(true);
  };

  const guardarUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !uEmail.trim()) return;

    let nuevos = [...config.usuarios];
    if (userEditId) {
      nuevos = nuevos.map(u => u.id === userEditId ? { ...u, email: uEmail, esAdminGlobal: uEsAdminGlobal, accesos: uEsAdminGlobal ? [] : uAccesos } : u);
    } else {
      nuevos.push({ id: Date.now().toString(), email: uEmail, esAdminGlobal: uEsAdminGlobal, accesos: uEsAdminGlobal ? [] : uAccesos });
    }
    
    guardarConfig({ ...config, usuarios: nuevos });
    setIsUserModalOpen(false);
  };

  const intentarEliminarUsuario = (id: string) => {
    setUserABorrar(id);
  };

  const confirmarEliminarUsuario = () => {
    if (!config || !userABorrar) return;
    const nuevos = config.usuarios.filter((u: any) => u.id !== userABorrar);
    guardarConfig({ ...config, usuarios: nuevos });
    setUserABorrar(null);
    mostrarToast("Acceso Revocado", "El usuario ya no tiene permisos.", "success");
  };

  if (status === "loading" || !config) return <div className="min-h-screen flex items-center justify-center font-bold text-primary animate-pulse">Cargando Panel de Administración...</div>;
  if (!session) return <div className="p-10 text-center">Acceso Denegado</div>;

  const miPerfil = session?.user?.email ? config.usuarios.find(u => u.email === session.user?.email) : null;
  const isSuperAdmin = miPerfil?.esAdminGlobal === true;
  const isDirectorLocal = miPerfil?.accesos?.some(a => a.rol === 'Director') === true;
  
  if (!isSuperAdmin && !isDirectorLocal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h1 className="text-3xl font-black text-red-500 mb-2">Acceso Restringido</h1>
        <p className="text-text/70 font-medium mb-6">Solo los Administradores Globales o Directores de Tienda tienen acceso a este portal.</p>
        <Link href="/" className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-opacity-90 transition-all">
          Volver a Mis Tableros
        </Link>
      </div>
    );
  }

  // Filtrado de seguridad: Qué usuarios ve un Director (solo los de sus tiendas)
  const misFranquiciasID = isSuperAdmin ? [] : (miPerfil?.accesos?.filter(a => a.rol === 'Director').map(a => a.franquiciaId) || []);
  let usuariosVisibles = isSuperAdmin ? [...config.usuarios] : config.usuarios.filter(u => 
    u.esAdminGlobal === false && u.accesos?.some(acc => misFranquiciasID.includes(acc.franquiciaId))
  );

  // V8: Aplicar Filtros Avanzados
  if (uBusqueda.trim()) {
    usuariosVisibles = usuariosVisibles.filter(u => u.email.toLowerCase().includes(uBusqueda.toLowerCase()));
  }

  if (uFiltroRol !== 'Todos') {
    if (uFiltroRol === 'AdminGlobal') {
      usuariosVisibles = usuariosVisibles.filter(u => u.esAdminGlobal);
    } else {
      usuariosVisibles = usuariosVisibles.filter(u => !u.esAdminGlobal && u.accesos?.some(a => a.rol === uFiltroRol));
    }
  }

  if (uFiltroFranq !== 'Todas') {
    usuariosVisibles = usuariosVisibles.filter(u => u.esAdminGlobal || u.accesos?.some(a => a.franquiciaId === uFiltroFranq));
  }

  // Ordenamiento Alfabético por Defecto
  usuariosVisibles.sort((a, b) => a.email.localeCompare(b.email));

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col gap-4 mb-8 bg-surface/80 dark:bg-surface/40 p-5 md:p-8 rounded-[2rem] shadow-xl shadow-accent/5 dark:shadow-accent/20 border border-borderr/50 dark:border-accent/20 backdrop-blur-md dark:backdrop-blur-2xl transition-all duration-300">
          <div className="w-full flex justify-start border-b border-borderr/50 pb-4 md:border-none md:pb-0 md:hidden">
            <Link href="/" className="p-2 bg-background border border-borderr rounded-full hover:bg-border/50 hover:scale-105 transition-all w-10 h-10 flex items-center justify-center font-bold text-text shrink-0 shadow-sm" title="Regresar al Hub">
              &lt;
            </Link>
          </div>
          <div className="flex items-center gap-4 w-full">
            <Link href="/" className="hidden md:flex p-2 bg-background border border-border rounded-full hover:bg-border/50 hover:scale-105 transition-all w-10 h-10 items-center justify-center font-bold text-text shrink-0 shadow-sm" title="Regresar al Hub">
              &lt;
            </Link>

            <label className="relative group cursor-pointer shrink-0 inline-block rounded-lg overflow-hidden border border-transparent hover:border-primary/50 transition-all p-1 bg-background shadow-inner">
              <input type="file" accept="image/*" className="hidden" onChange={handleSubirLogo} />
              {config?.logoBase64 ? (
                <img src={config.logoBase64} alt="VeganOps Logo" className="w-[50px] h-[50px] object-contain drop-shadow-md transition-opacity group-hover:opacity-50" />
              ) : (
                <Image src="/logo.png" alt="VeganOps Logo" width={50} height={50} className="drop-shadow-md transition-opacity group-hover:opacity-50" />
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              </div>
            </label>

            <div>
              <h1 className="text-xl md:text-2xl font-black text-primary">Master Panel: Centro de Administración</h1>
              <p className="text-xs md:text-sm text-text/60 font-medium">Gestión global de ubicaciones físicas y permisos de personal.</p>
            </div>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row gap-2 md:gap-4 mb-6 border-b border-borderr pb-4 overflow-x-auto whitespace-nowrap hide-scrollbar">
          {isSuperAdmin && (
            <button 
              onClick={() => setActiveTab('franquicias')}
              className={`px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-bold rounded-lg md:rounded-t-xl transition-all ${activeTab === 'franquicias' ? 'bg-surface text-primary border border-primary md:border-b-0 md:border-t-2 shadow-sm' : 'bg-background border border-borderr md:border-transparent text-text/60 hover:text-text'}`}
            >
              🏢 Gestión de Franquicias / Tiendas
            </button>
          )}
          <button 
            onClick={() => setActiveTab('usuarios')}
            className={`px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-bold rounded-lg md:rounded-t-xl transition-all ${activeTab === 'usuarios' || !isSuperAdmin ? 'bg-surface text-primary border border-primary md:border-b-0 md:border-t-2 shadow-sm' : 'bg-background border border-borderr md:border-transparent text-text/60 hover:text-text'}`}
          >
            👥 Usuarios y Roles
          </button>
          {isSuperAdmin && (
            <button 
              onClick={() => setActiveTab('plantillas')}
              className={`px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-bold rounded-lg md:rounded-t-xl transition-all ${activeTab === 'plantillas' ? 'bg-surface text-primary border border-primary md:border-b-0 md:border-t-2 shadow-sm' : 'bg-background border border-borderr md:border-transparent text-text/60 hover:text-text'}`}
            >
              📋 Plantillas Base
            </button>
          )}
        </div>

        {activeTab === 'franquicias' && isSuperAdmin && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-text">Tiendas Registradas ({config.franquicias.length})</h2>
              <button 
                onClick={() => abrirModalFranq()}
                className="bg-primary text-white px-5 py-2 rounded-lg font-bold shadow hover:bg-opacity-90 transition-all flex items-center gap-2"
              >
                + Nueva Franquicia
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {config.franquicias.map(f => (
                <div key={f.id} className="bg-surface border border-borderr/80 p-6 rounded-2xl shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-black text-text">{f.nombre}</h3>
                    <span className="px-2 py-1 bg-green-500/10 text-green-600 text-[10px] font-bold uppercase rounded-md border border-green-500/20">{f.status}</span>
                  </div>
                  
                  {f.direccion ? (
                    <div className="mb-6 flex flex-col gap-2">
                      <a href={f.direccion.startsWith('http') ? f.direccion : `https://maps.google.com/?q=${encodeURIComponent(f.direccion)}`} target="_blank" rel="noreferrer" className="text-sm text-text/60 flex items-start gap-2 hover:text-blue-500 transition-colors">
                        📍 <span className="underline decoration-dotted block truncate">{f.direccion}</span>
                      </a>
                      <div className="w-full h-32 rounded-xl overflow-hidden border border-border shadow-inner bg-surface/50">
                        <iframe 
                          width="100%" 
                          height="100%" 
                          style={{ border: 0 }} 
                          loading="lazy" 
                          allowFullScreen 
                          referrerPolicy="no-referrer-when-downgrade" 
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(f.direccion)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                        ></iframe>
                      </div>
                    </div>
                  ) : (
                      <span className="text-sm text-red-400 mb-6 block italic">Sin dirección (Virtual)</span>
                  )}
                  
                  <div className="mt-auto flex justify-end gap-2 border-t border-borderr pt-4">
                    <button onClick={() => abrirModalFranq(f)} className="text-xs font-bold px-3 py-1.5 bg-primary/10 text-primary rounded hover:bg-primary hover:text-white transition-colors">Editar</button>
                    <button onClick={() => intentarEliminarFranquicia(f.id)} className="text-xs font-bold px-3 py-1.5 bg-red-100 text-red-600 rounded hover:bg-red-500 hover:text-white transition-colors">Eliminar</button>
                  </div>
                </div>
              ))}
              {config.franquicias.length === 0 && <div className="col-span-full text-center py-10 text-text/40 font-bold border-2 border-dashed border-borderr rounded-xl">No hay tiendas dadas de alta.</div>}
            </div>
          </div>
        )}

        {activeTab === 'usuarios' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h2 className="text-2xl font-black text-text">Directorio de Personal ({config.usuarios.length})</h2>
              <div className="flex gap-3 w-full md:w-auto">
                <button 
                  onClick={sincronizarNube}
                  className="bg-accent/10 border-2 border-accent text-accent px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-2 flex-1 md:flex-none"
                  title="Aplica retroactivamente a todos los usuarios vigentes el acceso base a Google Drive para que no experimenten tableros vacíos."
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21L21.5 8"></path></svg> 
                  Sincronizar Permisos (Drive)
                </button>
                <button 
                  onClick={() => abrirModalUser()}
                  className="bg-primary text-white px-5 py-2 rounded-lg font-bold shadow hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 flex-1 md:flex-none"
                >
                  + Asignar Nuevo Usuario
                </button>
              </div>
            </div>

            {/* Glosario de Seguridad RBAC */}
            <div className="bg-surface/80 p-5 rounded-2xl border border-borderr shadow-sm mb-6 flex flex-col gap-3">
              <h3 className="font-black text-primary flex items-center gap-2 text-sm uppercase tracking-wider">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Diccionario de Permisos y Roles (RBAC)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-1">
                <div className="flex gap-3">
                  <div className="bg-primary/10 text-primary font-bold px-2 py-1 rounded w-32 shrink-0 text-center h-fit text-xs border border-primary/20">Admin Global</div>
                  <p className="text-text/80 leading-snug"><strong className="text-text">Dios del Ecosistema.</strong> Unico con acceso a esta pantalla de Administración y edición de Plantillas. Ve *todos* los tableros de *todas* las franquicias, pero las Columnas Operativas (Kanban/Pedidos) están ocultas para evitar *micromanagement*.</p>
                </div>
                <div className="flex gap-3">
                  <div className="bg-purple-500/10 text-purple-600 font-bold px-2 py-1 rounded w-32 shrink-0 text-center h-fit text-xs border border-purple-500/20">Director</div>
                  <p className="text-text/80 leading-snug"><strong className="text-text">Máxima Autoridad en Tienda.</strong> Ve y Edita absolutamente todo en las sucursales asignadas. Diseña flujos Kanban, borra tareas caducadas de otros y estructura la carga laboral. (Limitado a 2 por local).</p>
                </div>
                <div className="flex gap-3">
                  <div className="bg-blue-500/10 text-blue-600 font-bold px-2 py-1 rounded w-32 shrink-0 text-center h-fit text-xs border border-blue-500/20">Coordinador</div>
                  <p className="text-text/80 leading-snug"><strong className="text-text">Líder Operativo.</strong> Posee el permiso de crear Tableros Nuevos para la sucursal asignada o duplicarlos. Adicionalmente, puede reordenar y alterar la estructura interna del Tablero.</p>
                </div>
                <div className="flex gap-3">
                  <div className="bg-gray-500/10 text-gray-500 font-bold px-2 py-1 rounded w-32 shrink-0 text-center h-fit text-xs border border-gray-500/20">Trabajador</div>
                  <p className="text-text/80 leading-snug"><strong className="text-text">Usuario Base.</strong> Experiencia de Solo-Lectura en las configuraciones de la tienda. Interactúa libremente con la pantalla operativa de *Kanban*, *Recetas* e *Ingredientes*, pero el Hub Global le bloquea botones administrativos.</p>
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-borderr overflow-hidden">
              {/* Barra de Herramientas V8 */}
              <div className="bg-background border-b border-borderr p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-1/3">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text/40" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input 
                    type="text" 
                    placeholder="Buscar por correo..." 
                    value={uBusqueda}
                    onChange={(e) => setUBusqueda(e.target.value)}
                    className="w-full bg-surface border border-borderr pl-10 pr-3 py-2 text-sm rounded-lg outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="flex w-full md:w-auto gap-2">
                  <select 
                    value={uFiltroRol} 
                    onChange={e => setUFiltroRol(e.target.value)}
                    className="bg-surface border border-borderr px-3 py-2 text-sm rounded-lg outline-none focus:border-primary cursor-pointer w-full md:w-auto"
                  >
                    <option value="Todos">Roles: Todos</option>
                    <option value="AdminGlobal">Admin Globales</option>
                    <option value="Director">Directores</option>
                    <option value="Coordinador">Coordinadores</option>
                    <option value="Trabajador">Trabajadores</option>
                  </select>
                  <select 
                    value={uFiltroFranq} 
                    onChange={e => setUFiltroFranq(e.target.value)}
                    className="bg-surface border border-borderr px-3 py-2 text-sm rounded-lg outline-none focus:border-primary cursor-pointer w-full md:w-auto truncate max-w-[200px]"
                  >
                    <option value="Todas">Franquicias: Todas</option>
                    {config.franquicias.map(f => (
                      <option key={f.id} value={f.id}>{f.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap md:whitespace-normal">
                <thead className="bg-background border-b border-borderr">
                  <tr>
                    <th className="p-3 md:p-4 font-bold text-xs md:text-sm text-text/60 uppercase">Email (Google)</th>
                    <th className="p-3 md:p-4 font-bold text-xs md:text-sm text-text/60 uppercase">Rol de Seguridad</th>
                    <th className="p-3 md:p-4 font-bold text-xs md:text-sm text-text/60 uppercase">Franquicia Asignada</th>
                    <th className="p-3 md:p-4 font-bold text-xs md:text-sm text-text/60 uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usuariosVisibles.map(u => (
                    <tr key={u.id} className="hover:bg-primary/5 transition-colors">
                      <td className="p-4 font-medium text-text">{u.email}</td>
                      <td className="p-4">
                        {u.esAdminGlobal ? (
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                            Admin Global
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1 items-start">
                            {u.accesos?.map((acc, i) => (
                              <span key={i} className={`px-2 py-0.5 text-[10px] font-bold rounded ${acc.rol === 'Coordinador' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                                {acc.rol}
                              </span>
                            ))}
                            {(!u.accesos || u.accesos.length === 0) && <span className="text-xs text-red-400 font-bold border border-red-200 px-2 py-0.5 rounded bg-red-50">Sin Perfil</span>}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-sm font-medium text-text/70">
                        {u.esAdminGlobal ? (
                          <span className="text-text">Acceso a todas las tiendas</span>
                        ) : (
                          <div className="flex flex-col gap-1 items-start">
                            {u.accesos?.map((acc, i) => (
                              <span key={i} className="text-xs font-bold truncate max-w-[150px]" title={config.franquicias.find(f => f.id === acc.franquiciaId)?.nombre || 'Tienda Eliminada'}>
                                🏪 {config.franquicias.find(f => f.id === acc.franquiciaId)?.nombre || 'Tienda Eliminada'}
                              </span>
                            ))}
                            {(!u.accesos || u.accesos.length === 0) && <span className="text-xs text-text/40">-</span>}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button onClick={() => abrirModalUser(u)} className="text-primary hover:underline text-sm font-bold">Editar</button>
                        {!u.esAdminGlobal && (
                          <button onClick={() => intentarEliminarUsuario(u.id)} className="text-red-500 hover:underline text-sm font-bold">Remover</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {usuariosVisibles.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-text/50 font-bold border-t border-borderr">No hay resultados para estos filtros.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plantillas' && isSuperAdmin && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-text">Insumos y Recetas Maestras</h2>
              <p className="text-sm text-text/60 font-medium max-w-lg text-right">Estas plantillas se insertarán automáticamente como base virgen en cada nuevo tablero creado para cualquier sucursal.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Columna Insumos */}
              <div className="bg-surface rounded-xl border border-borderr p-6 shadow-sm flex flex-col h-[500px]">
                <div className="flex justify-between items-center mb-4 border-b border-borderr pb-2">
                  <h3 className="text-lg font-black text-text">Insumos Base ({config.plantillasIngredientes?.length || 0})</h3>
                  <button onClick={() => abrirModalInsumo()} className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                    + Insumo
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {(config.plantillasIngredientes || []).map(ins => (
                    <div key={ins.id} className="p-3 border border-borderr/50 rounded-lg hover:border-primary/50 transition-colors bg-background/50 flex justify-between items-center group">
                      <div>
                        <span className="font-bold text-sm block">{ins.nombre}</span>
                        <span className="text-[10px] text-text/60 uppercase font-black tracking-wider px-2 py-0.5 bg-border/50 rounded-full inline-block mt-1">
                          Ref: {ins.unidad}
                        </span>
                      </div>
                      <div className="hidden group-hover:flex items-center gap-2">
                        <button onClick={() => abrirModalInsumo(ins)} className="text-primary hover:underline text-xs font-bold">Editar</button>
                        <button onClick={() => eliminarInsumoGlobal(ins.id)} className="text-red-500 hover:underline text-xs font-bold">Eliminar</button>
                      </div>
                    </div>
                  ))}
                  {(!config.plantillasIngredientes || config.plantillasIngredientes.length === 0) && (
                    <p className="text-center text-text/40 text-sm font-medium mt-10">No hay insumos maestros registrados.</p>
                  )}
                </div>
              </div>

              {/* Columna Recetas */}
              <div className="bg-surface rounded-xl border border-borderr p-6 shadow-sm flex flex-col h-[500px]">
                <div className="flex justify-between items-center mb-4 border-b border-borderr pb-2">
                  <h3 className="text-lg font-black text-text">Recetas Corporativas ({config.plantillasRecetas?.length || 0})</h3>
                  <button onClick={() => abrirModalReceta()} className="bg-accent/10 text-accent hover:bg-accent hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                    + Receta
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {(config.plantillasRecetas || []).map(r => (
                    <div key={r.id} className="p-3 border border-borderr/50 rounded-lg hover:border-accent/50 transition-colors bg-background/50 flex justify-between items-center group">
                      <div>
                        <span className="font-bold text-sm block text-accent">{r.nombre}</span>
                        <span className="text-xs text-text/60 block mt-1">{r.ingredientes.length} ingredientes • {r.pasos.length} pasos</span>
                      </div>
                      <div className="hidden group-hover:flex items-center gap-2">
                        <button onClick={() => abrirModalReceta(r)} className="text-accent hover:underline text-xs font-bold">Editar</button>
                        <button onClick={() => eliminarRecetaGlobal(r.id)} className="text-red-500 hover:underline text-xs font-bold">Eliminar</button>
                      </div>
                    </div>
                  ))}
                  {(!config.plantillasRecetas || config.plantillasRecetas.length === 0) && (
                    <p className="text-center text-text/40 text-sm font-medium mt-10">No hay recetas maestras elaboradas.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Franquicia */}
      <Modal isOpen={isFranqModalOpen} onClose={() => setIsFranqModalOpen(false)} title={franqEditId ? "Editar Franquicia" : "Alta de Nueva Franquicia"}>
        <form onSubmit={guardarFranquicia} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-bold text-text/80 mb-2 uppercase">Nombre Comercial</label>
            <input type="text" value={fNombre} onChange={e => setFNombre(e.target.value)} placeholder="Ej. Sucursal Lavalle" className="w-full bg-background border-2 border-borderr p-3 rounded-lg outline-none focus:border-primary focus:ring-2 disabled:opacity-50 font-medium" autoFocus required />
          </div>
          <div>
            <label className="block text-sm font-bold text-text/80 mb-2 uppercase">Dirección (Física o URL Maps)</label>
            <input type="text" value={fDireccion} onChange={e => setFDireccion(e.target.value)} placeholder="Ej. Lavalle 400 o link goo.gl..." className="w-full bg-background border-2 border-borderr p-3 rounded-lg outline-none focus:border-primary focus:ring-2 disabled:opacity-50 font-medium" />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setIsFranqModalOpen(false)} className="px-5 py-2.5 rounded-lg font-bold text-text/60 hover:bg-border/50">Cancelar</button>
            <button type="submit" disabled={!fNombre.trim()} className="bg-primary text-white px-5 py-2.5 rounded-lg font-bold shadow hover:bg-opacity-90">{franqEditId ? 'Guardar Cambios' : 'Crear Tienda'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal Usuario */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={userEditId ? "Modificar Permisos" : "Añadir Personal"}>
        <form onSubmit={guardarUsuario} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-bold text-text/80 mb-2 uppercase">Correo Electrónico (Cuenta Google)</label>
            <input type="email" value={uEmail} onChange={e => setUEmail(e.target.value)} placeholder="ejemplo@gmail.com" className="w-full bg-background border-2 border-borderr p-3 rounded-lg outline-none focus:border-primary focus:ring-2 disabled:opacity-50 font-medium" autoFocus required />
          </div>
          
          {isSuperAdmin && (
            <div className={`flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg ${userEditId && config?.usuarios.find(u => u.id === userEditId)?.esAdminGlobal ? 'opacity-75' : ''}`}>
              <input 
                 type="checkbox" 
                 id="adminGlobal" 
                 checked={uEsAdminGlobal} 
                 onChange={e => setUEsAdminGlobal(e.target.checked)} 
                 disabled={userEditId ? config?.usuarios.find(u => u.id === userEditId)?.esAdminGlobal : false}
                 className="w-5 h-5 accent-purple-600 rounded cursor-pointer disabled:cursor-not-allowed" 
              />
              <label htmlFor="adminGlobal" className="text-sm font-bold text-purple-900 cursor-pointer">
                Otorgar Privilegios de Admin Global <br/>
                {userEditId && config?.usuarios.find(u => u.id === userEditId)?.esAdminGlobal ? (
                  <span className="text-xs font-bold text-red-500">Privilegio inamovible por seguridad.</span>
                ) : (
                  <span className="text-xs font-normal text-purple-700">Acceso a este panel y control total sobre todas las sucursales.</span>
                )}
              </label>
            </div>
          )}
          
          {!uEsAdminGlobal && (
            <div className="border border-borderr rounded-lg p-4 bg-surface shadow-inner">
              <label className="block text-sm font-bold text-text/80 mb-3 uppercase">Asignaciones por Sucursal</label>
              
              <div className="space-y-2 mb-4">
                {uAccesos.map((acc, index) => (
                  <div key={index} className="flex items-center justify-between border border-borderr p-2 rounded bg-background">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-text truncate max-w-[200px]">{config.franquicias.find(f=>f.id===acc.franquiciaId)?.nombre || 'Tienda Invalida'}</span>
                      <span className="text-[10px] font-bold uppercase text-primary">{acc.rol}</span>
                    </div>
                    <button type="button" onClick={() => setUAccesos(uAccesos.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                ))}
                {uAccesos.length === 0 && <p className="text-xs text-text/50 italic text-center py-2">No hay accesos configurados. El usuario no verá ningún tablero.</p>}
              </div>

              <div className="border-t border-borderr/50 pt-3 flex flex-col gap-2">
                <span className="text-xs font-bold text-text/60 uppercase">Agregar nuevo acceso</span>
                <div className="flex flex-col xl:flex-row gap-2">
                  <select id="newFranq" className="flex-1 bg-background border border-borderr p-2 rounded text-sm outline-none focus:border-primary">
                    <option value="">Seleccionar Sucursal...</option>
                    {config.franquicias
                      .filter(f => isSuperAdmin || misFranquiciasID.includes(f.id))
                      .filter(f => !uAccesos.some(a => a.franquiciaId === f.id))
                      .map(f => (
                      <option key={f.id} value={f.id}>{f.nombre}</option>
                    ))}
                  </select>
                  <select id="newRol" className="w-full xl:w-32 bg-background border border-borderr p-2 rounded text-sm outline-none focus:border-primary" onChange={(e) => {
                     // Lógica visual básica (el backend bloquea la inyección real)
                  }}>
                    <option value="Trabajador">Trabajador</option>
                    <option value="Coordinador">Coordinador</option>
                    <option value="Director">Director</option>
                  </select>
                  <button type="button" onClick={() => {
                    const fid = (document.getElementById('newFranq') as HTMLSelectElement).value;
                    const r = (document.getElementById('newRol') as HTMLSelectElement).value as any;
                    
                    if(fid && r === 'Director') {
                       // Validar tope de Directores localmente antes de añadir
                       let directoresEnTienda = 0;
                       config.usuarios.forEach(gloU => {
                          if (!gloU.esAdminGlobal) {
                             gloU.accesos?.forEach(acc => {
                                if (acc.franquiciaId === fid && acc.rol === 'Director') directoresEnTienda++;
                             });
                          }
                       });
                       if (directoresEnTienda >= 2) {
                          mostrarToast("Límite de Directiva", "Esta tienda ya cuenta con el máximo de 2 Directores autorizados.", "error");
                          return;
                       }
                    }

                    if(fid) {
                      setUAccesos([...uAccesos, { franquiciaId: fid, rol: r }]);
                      (document.getElementById('newFranq') as HTMLSelectElement).value = '';
                    }
                  }} className="bg-primary/10 text-primary font-bold px-3 py-2 rounded text-sm hover:bg-primary hover:text-white transition whitespace-nowrap">Añadir</button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-5 py-2.5 rounded-lg font-bold text-text/60 hover:bg-border/50">Cancelar</button>
            <button type="submit" disabled={!uEmail.trim() || (!uEsAdminGlobal && uAccesos.length === 0)} className="bg-primary text-white px-5 py-2.5 rounded-lg font-bold shadow hover:bg-opacity-90 disabled:opacity-50">{userEditId ? 'Aplicar Permisos' : 'Dar de Alta'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal Insumo Base */}
      <Modal isOpen={isModalInsumoOpen} onClose={() => setIsModalInsumoOpen(false)} title={insumoEditId ? "Editar Insumo Maestro" : "Nuevo Insumo Corporativo"}>
        <form onSubmit={guardarInsumoGlobal} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-text/80 mb-2 uppercase">Nombre del Insumo</label>
            <input type="text" value={ibNombre} onChange={e => setIBNombre(e.target.value)} placeholder="Ej. Harina de Trigo Integral" className="w-full bg-background border-2 border-borderr p-3 rounded-lg outline-none focus:border-primary focus:ring-2 font-medium" autoFocus required />
          </div>
          <div>
            <label className="block text-sm font-bold text-text/80 mb-2 uppercase">Unidad de Medida</label>
            <select value={ibUnidad} onChange={e => setIBUnidad(e.target.value)} className="w-full bg-background border-2 border-borderr p-3 rounded-lg outline-none focus:border-primary focus:ring-2 font-medium cursor-pointer">
              <option value="g">Gramos (g)</option>
              <option value="Kg">Kilogramos (Kg)</option>
              <option value="L">Litros (L)</option>
              <option value="ml">Mililitros (ml)</option>
              <option value="Unidad">Unidad / Pieza</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setIsModalInsumoOpen(false)} className="px-5 py-2.5 rounded-lg font-bold text-text/60 hover:bg-border/50">Cancelar</button>
            <button type="submit" disabled={!ibNombre.trim()} className="bg-primary text-white px-5 py-2.5 rounded-lg font-bold shadow hover:bg-opacity-90">Guardar Maestro</button>
          </div>
        </form>
      </Modal>

      {/* Modal Receta Corporativa */}
      <Modal isOpen={isModalRecetaOpen} onClose={() => setIsModalRecetaOpen(false)} title={recetaEditId ? "Editar Receta Corporativa" : "Diseñar Receta Base"}>
        <form onSubmit={guardarRecetaGlobal} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-bold text-text/80 mb-2 uppercase">Nombre de la Receta</label>
            <input type="text" value={rbNombre} onChange={e => setRBNombre(e.target.value)} placeholder="Ej. Masa Madre Base" className="w-full bg-background border-2 border-borderr p-3 rounded-lg outline-none focus:border-accent focus:ring-2 font-medium" autoFocus required />
          </div>
          
          <div className="border border-borderr rounded-lg p-4 bg-surface shadow-inner">
            <label className="block text-sm font-bold text-text/80 mb-3 uppercase">Ingredientes Requeridos</label>
            <div className="space-y-2 mb-4">
              {rbIngredientes.map((ing, index) => {
                const ins = config?.plantillasIngredientes?.find(i => i.id === ing.insumoId);
                return (
                  <div key={index} className="flex justify-between items-center p-2 border border-borderr rounded bg-background">
                    <span className="font-bold text-sm text-text">{ins ? ins.nombre : 'Insumo Borrado'} <span className="text-accent ml-2 text-xs">({ing.cantidad} {ins?.unidad || '?'})</span></span>
                    <button type="button" onClick={() => setRBIngredientes(rbIngredientes.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                );
              })}
              {rbIngredientes.length === 0 && <p className="text-xs text-text/50 italic text-center py-2">No hay ingredientes añadidos.</p>}
            </div>
            
            <div className="flex gap-2">
              <select value={rbTempSubId} onChange={e => setRbTempSubId(e.target.value)} className="flex-1 bg-background border border-borderr p-2 rounded text-sm outline-none focus:border-accent">
                <option value="">Seleccionar Insumo Maestro...</option>
                {config?.plantillasIngredientes?.map(i => (
                  <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                ))}
              </select>
              <input type="number" min="0" placeholder="Cant." value={rbTempSubCant} onChange={e => setRbTempSubCant(e.target.value)} className="w-20 bg-background border border-borderr p-2 rounded text-sm outline-none focus:border-accent" />
              <button type="button" onClick={() => {
                if(rbTempSubId && rbTempSubCant) {
                  setRBIngredientes([...rbIngredientes, { insumoId: rbTempSubId, cantidad: Number(rbTempSubCant) }]);
                  setRbTempSubId('');
                }
              }} className="bg-accent/10 text-accent font-bold px-3 py-2 rounded text-sm hover:bg-accent hover:text-white transition">Añadir</button>
            </div>
          </div>
          
          <div className="border border-borderr rounded-lg p-4 bg-surface shadow-inner">
            <label className="block text-sm font-bold text-text/80 mb-3 uppercase">Paso a Paso</label>
            <div className="space-y-2 mb-4">
              {rbPasos.map((paso, index) => (
                <div key={index} className="flex justify-between items-start gap-3 p-2 border border-borderr rounded bg-background text-sm">
                  <span className="font-bold text-accent shrink-0">{index + 1}.</span>
                  <span className="text-text/80 break-words flex-1 leading-snug">{paso}</span>
                  <button type="button" onClick={() => setRBPasos(rbPasos.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700 shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Describir nuevo paso..." value={rbPasoTemp} onChange={e => setRbPasoTemp(e.target.value)} onKeyDown={e => {
                if(e.key === 'Enter') { 
                  e.preventDefault(); 
                  if(rbPasoTemp.trim()){ setRBPasos([...rbPasos, rbPasoTemp.trim()]); setRbPasoTemp(''); } 
                }
              }} className="flex-1 bg-background border border-borderr p-2 rounded text-sm outline-none focus:border-accent" />
              <button type="button" onClick={() => {
                if(rbPasoTemp.trim()) { setRBPasos([...rbPasos, rbPasoTemp.trim()]); setRbPasoTemp(''); }
              }} className="bg-accent/10 text-accent font-bold px-3 py-2 rounded text-sm hover:bg-accent hover:text-white transition">Añadir</button>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setIsModalRecetaOpen(false)} className="px-5 py-2.5 rounded-lg font-bold text-text/60 hover:bg-border/50">Cancelar</button>
            <button type="submit" disabled={!rbNombre.trim()} className="bg-accent text-white px-5 py-2.5 rounded-lg font-bold shadow hover:bg-opacity-90">Construir Patrón Receta</button>
          </div>
        </form>
      </Modal>

      {/* Modales de Confirmación de Borrado */}
      <Modal isOpen={!!franqABorrar} onClose={() => setFranqABorrar(null)} title="Eliminar Franquicia">
        <div className="flex flex-col gap-4">
          <p className="text-text/80 font-medium tracking-tight">
            ¿Estás seguro de que deseas desactivar este local comercial? <br/>
            Los usuarios actualmente asignados quedarán como "Sin asignar".
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setFranqABorrar(null)} className="px-5 py-2.5 rounded-lg font-bold text-text/60 hover:bg-border/50">Cancelar</button>
            <button onClick={confirmarEliminarFranquicia} className="bg-red-500 text-white px-5 py-2.5 rounded-lg font-bold shadow hover:bg-opacity-90">Sí, Eliminar</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!userABorrar} onClose={() => setUserABorrar(null)} title="Revocar Permisos">
        <div className="flex flex-col gap-4">
          <p className="text-text/80 font-medium">¿Confirmas que deseas retirar todo acceso a este usuario?</p>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setUserABorrar(null)} className="px-5 py-2.5 rounded-lg font-bold text-text/60 hover:bg-border/50">Mantener Acceso</button>
            <button onClick={confirmarEliminarUsuario} className="bg-red-500 text-white px-5 py-2.5 rounded-lg font-bold shadow hover:bg-opacity-90">Revocar Permiso</button>
          </div>
        </div>
      </Modal>

      {/* Sistema de Toasts (Compartido UI) */}
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
