'use client';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { io, Socket } from 'socket.io-client';
import { TableroData, Columna, Tarjeta } from '../types';
import Modal from './components/Modal';
import Dashboard from './components/Dashboard';
import RecipesList from './components/RecipesList';
import OrdersList from './components/OrdersList';
import IngredientsList from './components/IngredientsList';
import Image from 'next/image';
import { toast } from 'react-hot-toast';

let socket: Socket;

export default function TableroView({ tableroId, usuario, userRole, volver }: { tableroId: string, usuario: string, userRole: string, volver: () => void }) {
  const [data, setData] = useState<TableroData | null>(null);
  const [online, setOnline] = useState(1);
  // V8: Privacidad - Ocultar operación cruda al Master
  const esAdminGlobal = userRole === 'AdminGlobal';
  const isReadonly = userRole === 'Trabajador' || esAdminGlobal;
  
  const vistasDisponibles = esAdminGlobal 
    ? ['panel', 'ingredientes', 'recetas'] 
    : ['kanban', 'pedidos', 'recetas', 'ingredientes', 'panel'];

  const [vista, setVista] = useState<'kanban' | 'ingredientes' | 'recetas' | 'pedidos' | 'panel'>(esAdminGlobal ? 'panel' : 'kanban');

  // Modal actions
  const [colParaNuevaTarjeta, setColParaNuevaTarjeta] = useState<string | null>(null);
  const [tituloNuevaTarjeta, setTituloNuevaTarjeta] = useState('');
  
  const [modalColumnaAbierto, setModalColumnaAbierto] = useState(false);
  const [tituloNuevaColumna, setTituloNuevaColumna] = useState('');

  useEffect(() => {
    socket = io();
    cargarDrive();

    socket.emit('unirse_tablero', { tableroId, usuario });

    socket.on('presencia', (msg) => setOnline(msg.onlineCount));
    socket.on('tablero_actualizado', (newData: TableroData) => setData(newData));
    socket.on('resincronizar', (dbData: TableroData) => setData(dbData));

    return () => { socket.disconnect(); };
  }, [tableroId]);

  const cargarDrive = async () => {
    try {
      const res = await fetch(`/api/drive?action=get&id=${tableroId}`);
      if (!res.ok) {
        throw new Error('No autorizado o tablero no encontrado');
      }
      const dbData = await res.json();
      if (dbData.error) {
         throw new Error(dbData.error);
      }
      // Garanizamos hidratación segura de arrays (Insumos, Recetas, etc) para tableros heredados (V2/V3)
      if (!dbData.columnas) dbData.columnas = [{ id: 'col-backlog', titulo: 'Backlog', orden: 0}, { id: 'col-todo', titulo: 'To Do', orden: 1}];
      dbData.insumos = dbData.insumos || [];
      dbData.recetas = dbData.recetas || [];
      dbData.pedidos = dbData.pedidos || [];
      dbData.tarjetas = dbData.tarjetas || [];
      setData(dbData);
    } catch (error: any) {
      console.error("Error al cargar tablero:", error);
      toast.error(error.message || "No se pudo cargar el tablero. Puede que no tengas permisos.");
      volver(); // Aborta la vista y regresa al listado
    }
  };

  const syncState = async (newState: TableroData) => {
    setData(newState);
    socket.emit('actualizar_tablero', { tableroId, data: newState, versionCliente: newState.version - 1 });
    fetch('/api/drive', { method: 'POST', body: JSON.stringify({ action: 'update', id: tableroId, data: newState }) });
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !data) return;
    const items = Array.from(data.tarjetas);
    const draggedItem = items.find(i => i.id === result.draggableId);
    if (!draggedItem) return;
    
    draggedItem.columnaId = result.destination.droppableId;
    const newState = { ...data, tarjetas: items, version: data.version + 1 };
    syncState(newState);
  };

  const confirmarAgregarTarjeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tituloNuevaTarjeta.trim() || !data || !colParaNuevaTarjeta) return;
    const nueva: Tarjeta = { 
      id: Date.now().toString(), 
      columnaId: colParaNuevaTarjeta, 
      titulo: tituloNuevaTarjeta, 
      descripcion: '', 
      etiquetas: [], 
      asignados: [], 
      checklists: [],
      creadoPor: usuario 
    };
    syncState({ ...data, tarjetas: [...data.tarjetas, nueva], version: data.version + 1 });
    setColParaNuevaTarjeta(null);
    setTituloNuevaTarjeta('');
  };

  const confirmarAgregarColumna = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tituloNuevaColumna.trim() || !data) return;
    const nueva: Columna = { id: Date.now().toString(), titulo: tituloNuevaColumna, orden: data.columnas.length };
    syncState({ ...data, columnas: [...data.columnas, nueva], version: data.version + 1 });
    setModalColumnaAbierto(false);
    setTituloNuevaColumna('');
  };

  const borrarTarjeta = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data) return;
    syncState({ ...data, tarjetas: data.tarjetas.filter(t => t.id !== id), version: data.version + 1 });
  };

  if (!data) return <div className="h-screen flex items-center justify-center font-bold text-2xl text-primary animate-pulse">Cargando Tablero...</div>;

  return (
    <div className="h-screen flex flex-col pt-4 overflow-hidden relative">
      <header className="px-4 md:px-6 py-4 md:pb-4 border-b border-borderr flex flex-col gap-4 bg-surface/80 backdrop-blur mx-4 rounded-xl shadow-sm mb-4">
        <div className="flex justify-between items-center w-full gap-2">
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button onClick={volver} className="p-2 bg-background border border-borderr rounded-full hover:bg-border/50 hover:scale-105 transition-all w-8 h-8 md:w-10 md:h-10 flex items-center justify-center font-bold text-text shrink-0 shadow-sm" title="Salir del tablero">
              &lt;
            </button>
            <Image src="/logo.png" alt="VeganOps" width={32} height={32} className="object-contain md:w-[40px] md:h-[40px]" />
            <h2 className="text-lg md:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent line-clamp-1">Tablero Operativo</h2>
          </div>
          <span className="text-[10px] md:text-xs font-bold bg-accent/10 border border-accent/20 text-accent px-2 py-1 md:px-3 md:py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap shadow-sm">
            <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent animate-pulse"></span>
            {online} <span className="hidden sm:inline">en línea</span>
          </span>
        </div>
        <div className="flex gap-2 bg-background p-1 md:p-1.5 rounded-lg border border-borderr w-full overflow-x-auto hide-scrollbar">
          {vistasDisponibles.map(v => (
            <button key={v} onClick={() => setVista(v as any)} className={`px-4 py-2 md:px-5 md:py-2.5 capitalize font-bold rounded-md text-xs md:text-sm transition-all whitespace-nowrap shrink-0 ${vista === v ? 'bg-primary text-white shadow-md' : 'text-text hover:bg-surface'}`}>
              {v}
            </button>
          ))}
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-2 pb-10">
        {vista === 'kanban' && !esAdminGlobal && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-6 items-start h-full px-4 w-max">
              {data.columnas.map(col => (
                <div key={col.id} className="bg-surface/90 backdrop-blur w-80 flex-shrink-0 rounded-xl shadow-lg border-2 border-borderr flex flex-col max-h-full transition-transform hover:-translate-y-1 duration-300">
                  <div className="p-4 font-black border-b border-borderr flex justify-between items-center text-text/80 bg-background/50 rounded-t-xl">
                    <span className="uppercase tracking-widest text-sm">{col.titulo}</span>
                    {!isReadonly && (
                      <button 
                        onClick={() => setColParaNuevaTarjeta(col.id)} 
                        className="text-primary hover:text-white bg-primary/10 hover:bg-primary font-bold w-7 h-7 flex items-center justify-center rounded-md transition-colors"
                        title="Añadir tarjeta"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <Droppable droppableId={col.id} isDropDisabled={isReadonly}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className={`p-4 flex-1 overflow-y-auto space-y-3 min-h-[100px] transition-colors rounded-b-xl ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}>
                        {data.tarjetas.filter(t => t.columnaId === col.id).map((tarjeta, index) => (
                          <Draggable key={tarjeta.id} draggableId={tarjeta.id} index={index} isDragDisabled={isReadonly}>
                            {(provided) => (
                              <div 
                                ref={provided.innerRef} 
                                {...provided.draggableProps} 
                                {...provided.dragHandleProps} 
                                className={`bg-background p-4 rounded-xl shadow-[0_2px_0_0_rgba(0,0,0,0.05)] border-2 border-borderr/50 ${!isReadonly ? 'cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md' : 'cursor-default'} transition-all group relative`}
                              >
                                {!isReadonly && (
                                  <button 
                                    onClick={(e) => borrarTarjeta(tarjeta.id, e)}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-text/30 hover:text-red-500 hover:bg-red-50 transition-all rounded"
                                    title="Eliminar tarea"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                  </button>
                                )}
                                <strong className="text-text block pr-6 text-sm mb-1">{tarjeta.titulo}</strong>
                                {tarjeta.creadoPor && <span className="text-[10px] text-text/40 font-bold uppercase block">Por: {tarjeta.creadoPor}</span>}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
              
              {!isReadonly && (
                <button 
                  onClick={() => setModalColumnaAbierto(true)}
                  className="w-80 flex-shrink-0 h-16 rounded-xl border-2 border-dashed border-primary/30 text-primary/70 font-bold flex items-center justify-center hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                >
                  + Nueva Columna
                </button>
              )}
            </div>
          </DragDropContext>
        )}

        {vista === 'ingredientes' && <IngredientsList board={data} syncState={syncState} usuario={usuario} isReadonly={isReadonly} />}
        {vista === 'recetas' && <RecipesList board={data} syncState={syncState} usuario={usuario} isReadonly={isReadonly} />}
        {vista === 'pedidos' && !esAdminGlobal && <OrdersList board={data} syncState={syncState} usuario={usuario} isReadonly={isReadonly} />}
        {vista === 'panel' && <Dashboard board={data} />}
      </main>

      {/* Modal Nueva Tarjeta */}
      <Modal isOpen={!!colParaNuevaTarjeta} onClose={() => setColParaNuevaTarjeta(null)} title="Nueva Tarjeta">
        <form onSubmit={confirmarAgregarTarjeta} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-text/80 mb-2 uppercase tracking-wide">
              Título de la tarea
            </label>
            <input 
              type="text" 
              value={tituloNuevaTarjeta}
              onChange={(e) => setTituloNuevaTarjeta(e.target.value)}
              placeholder="Ej. Revisar inventario de semillas" 
              className="w-full bg-background border-2 border-borderr p-3 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-medium"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setColParaNuevaTarjeta(null)} className="px-5 py-2.5 rounded-lg font-bold text-text/60 hover:bg-border/50 transition-colors">Cancelar</button>
            <button type="submit" disabled={!tituloNuevaTarjeta.trim()} className="bg-primary text-white px-5 py-2.5 rounded-lg font-bold shadow-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">Añadir Tarjeta</button>
          </div>
        </form>
      </Modal>

      {/* Modal Nueva Columna */}
      <Modal isOpen={modalColumnaAbierto} onClose={() => setModalColumnaAbierto(false)} title="Nueva Columna">
        <form onSubmit={confirmarAgregarColumna} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-text/80 mb-2 uppercase tracking-wide">
              Título de la columna
            </label>
            <input 
              type="text" 
              value={tituloNuevaColumna}
              onChange={(e) => setTituloNuevaColumna(e.target.value)}
              placeholder="Ej. QA / Revisión" 
              className="w-full bg-background border-2 border-borderr p-3 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-medium"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModalColumnaAbierto(false)} className="px-5 py-2.5 rounded-lg font-bold text-text/60 hover:bg-border/50 transition-colors">Cancelar</button>
            <button type="submit" disabled={!tituloNuevaColumna.trim()} className="bg-primary text-white px-5 py-2.5 rounded-lg font-bold shadow-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">Crear Columna</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
