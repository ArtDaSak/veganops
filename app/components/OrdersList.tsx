'use client';
import { TableroData, Pedido } from '../../types';
import { useState } from 'react';
import { Plus, Trash2, ShoppingBag } from 'lucide-react';
import Swal from 'sweetalert2';
import Modal from './Modal';

interface Props {
  board: TableroData;
  syncState: (newState: TableroData) => void;
  usuario: string;
  isReadonly?: boolean;
}

export default function OrdersList({ board, syncState, usuario, isReadonly }: Props) {
  const [modalPedidoAbierto, setModalPedidoAbierto] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState('');
  const [nuevoTipoPedido, setNuevoTipoPedido] = useState<'Tienda' | 'Llevar'>('Tienda');
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  
  const [modalItemAbierto, setModalItemAbierto] = useState<{orderId: string} | null>(null);
  const [itemReceta, setItemReceta] = useState('');
  const [itemMult, setItemMult] = useState('1');

  const confirmAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if(!nuevoCliente.trim()) return;
    const nuevo: Pedido = {
      id: Date.now().toString(),
      cliente: nuevoCliente,
      fecha: new Date().toISOString().split('T')[0],
      estado: 'Pendiente',
      tipoPedido: nuevoTipoPedido,
      direccion: nuevoTipoPedido === 'Llevar' ? nuevaDireccion : undefined,
      items: [],
      creadoPor: usuario
    }
    syncState({...board, pedidos: [...(board.pedidos || []), nuevo], version: board.version + 1});
    setModalPedidoAbierto(false);
    setNuevoCliente('');
    setNuevaDireccion('');
    setNuevoTipoPedido('Tienda');
  }

  const changeStatus = (id: string, estado: Pedido['estado']) => {
    syncState({
      ...board,
      pedidos: board.pedidos.map(o => o.id === id ? { ...o, estado } : o),
      version: board.version + 1
    });
  };

  const deleteOrder = async (id: string) => {
    const alert = await Swal.fire({ title: '¿Eliminar pedido?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Eliminar' });
    if(!alert.isConfirmed) return;
    syncState({ ...board, pedidos: board.pedidos.filter(o => o.id !== id), version: board.version + 1 });
  };

  const confirmAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if(!modalItemAbierto || !itemReceta || !itemMult) return;
    const orderId = modalItemAbierto.orderId;

    syncState({
      ...board,
      pedidos: board.pedidos.map(o => o.id === orderId ? {
        ...o,
        items: [...o.items, { recetaId: itemReceta, multiplicador: Number(itemMult) }]
      } : o),
      version: board.version + 1
    });
    setModalItemAbierto(null);
    setItemReceta('');
    setItemMult('1');
  };

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-surface/50 p-6 rounded-2xl border border-borderr shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-accent flex items-center gap-3">
            <ShoppingBag size={32} /> Gestión de Pedidos
          </h2>
          <p className="text-text/60 font-medium mt-1">Lleva el control de los despachos y producción vinculada a recetas.</p>
        </div>
        {!isReadonly && (
          <button onClick={() => setModalPedidoAbierto(true)} className="bg-accent text-white px-5 py-3 rounded-xl hover:bg-opacity-90 flex items-center gap-2 font-bold shadow-md hover:scale-105 transition-all">
            <Plus size={20} strokeWidth={3} /> Registrar Pedido
          </button>
        )}
      </div>

      <div className="bg-surface rounded-2xl shadow-md border-2 border-borderr overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap lg:whitespace-normal">
          <thead>
            <tr className="bg-background border-b-2 border-borderr/80 text-sm text-text/50 uppercase tracking-widest">
              <th className="p-5 font-bold">Cliente / Proyecto</th>
              <th className="p-5 font-bold">Fecha</th>
              <th className="p-5 font-bold">Progreso</th>
              <th className="p-5 font-bold">Módulos (Recetas)</th>
              <th className="p-5 font-bold text-right">Opciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {(board.pedidos || []).map(order => (
              <tr key={order.id} className="hover:bg-background/40 transition">
                <td className="p-5">
                  <div className="font-black text-lg flex items-center gap-2">
                    {order.cliente}
                    {order.tipoPedido === 'Llevar' ? (
                      <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">Llevar</span>
                    ) : (
                      <span className="bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">Tienda</span>
                    )}
                  </div>
                  {order.creadoPor && <div className="text-[10px] text-text/40 font-bold uppercase mt-1">Por: {order.creadoPor}</div>}
                  {order.tipoPedido === 'Llevar' && order.direccion && (
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(order.direccion)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 flex items-center gap-1">
                      📍 {order.direccion}
                    </a>
                  )}
                </td>
                <td className="p-5 text-sm font-bold text-text/40">{order.fecha}</td>
                <td className="p-5">
                  <select 
                    value={order.estado}
                    disabled={isReadonly}
                    onChange={(e) => changeStatus(order.id, e.target.value as any)}
                    className={`text-sm px-3 py-1.5 rounded-lg font-black outline-none border-2 transition ${
                      order.estado === 'Pendiente' ? 'bg-orange-50 text-orange-600 border-orange-200 focus:border-orange-500' :
                      order.estado === 'Preparación' ? 'bg-blue-50 text-blue-600 border-blue-200 focus:border-blue-500' :
                      order.estado === 'En transporte' ? 'bg-indigo-50 text-indigo-600 border-indigo-200 focus:border-indigo-500' :
                      'bg-green-50 text-green-600 border-green-200 focus:border-green-500'
                    } ${isReadonly ? 'appearance-none cursor-default opacity-90' : 'cursor-pointer'}`}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Preparación">En Preparación</option>
                    {order.tipoPedido === 'Llevar' && <option value="En transporte">En Transporte</option>}
                    <option value="Entregado">Completado</option>
                  </select>
                </td>
                <td className="p-5 text-sm font-medium">
                  {order.items.length === 0 ? (
                    <span className="text-text/30 italic">Sin despachos</span>
                  ) : (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {order.items.map((item, i) => {
                        const r = board.recetas?.find(r => r.id === item.recetaId);
                        return (
                          <span key={i} className="bg-background border border-borderr px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-2 font-bold shadow-sm">
                            {r?.nombre || 'Receta eliminada'} 
                            <span className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-xs">x{item.multiplicador}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {!isReadonly && (
                    <button onClick={() => {
                      if(!board.recetas || board.recetas.length === 0) {
                        Swal.fire({ title: "Atención", text: "Crea recetas primero en la pestaña 'Recetas'.", icon: "warning" });
                        return;
                      }
                      setItemReceta(board.recetas[0].id);
                      setModalItemAbierto({orderId: order.id});
                    }} className="text-xs text-primary font-bold hover:underline py-1 flex items-center gap-1">
                      <Plus size={14} strokeWidth={3} /> Añadir Producto
                    </button>
                  )}
                </td>
                <td className="p-5 text-right">
                  {!isReadonly && (
                    <button onClick={() => deleteOrder(order.id)} className="text-text/30 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition">
                      <Trash2 size={20} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {(!board.pedidos || board.pedidos.length === 0) && (
              <tr>
                <td colSpan={5} className="p-16 text-center text-text/40">
                  <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
                  <h3 className="text-xl font-bold text-text/60">No hay pedidos pendientes</h3>
                  <p>Inicia registrando el pedido de un cliente o tienda.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalPedidoAbierto} onClose={() => setModalPedidoAbierto(false)} title="Registrar Pedido">
        <form onSubmit={confirmAddOrder} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-text/60 mb-2 uppercase tracking-wide">Nombre del Cliente / Local</label>
            <input type="text" value={nuevoCliente} onChange={e=>setNuevoCliente(e.target.value)} placeholder="Ej. Tienda Saludable X" className="w-full p-3 border-2 border-borderr bg-background rounded-lg font-bold outline-none focus:border-accent" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-bold text-text/60 mb-2 uppercase tracking-wide">Tipo de Pedido</label>
            <select value={nuevoTipoPedido} onChange={e=>setNuevoTipoPedido(e.target.value as any)} className="w-full p-3 border-2 border-borderr bg-background rounded-lg font-bold outline-none focus:border-accent">
              <option value="Tienda">Para Consumir en Tienda</option>
              <option value="Llevar">Para Llevar (Delivery/Recojo)</option>
            </select>
          </div>
          {nuevoTipoPedido === 'Llevar' && (
            <div>
              <label className="block text-xs font-bold text-text/60 mb-2 uppercase tracking-wide">Dirección de Envío (Opcional)</label>
              <input type="text" value={nuevaDireccion} onChange={e=>setNuevaDireccion(e.target.value)} placeholder="Ej. Calle Los Pinos 123" className="w-full p-3 border-2 border-borderr bg-background rounded-lg font-bold outline-none focus:border-accent" />
            </div>
          )}
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModalPedidoAbierto(false)} className="font-bold px-5 py-2 hover:bg-border/50 rounded-lg text-text/60">Cerrar</button>
            <button type="submit" disabled={!nuevoCliente} className="font-bold px-5 py-2 bg-accent text-white rounded-lg disabled:opacity-50 shadow-md">Crear</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!modalItemAbierto} onClose={() => setModalItemAbierto(null)} title="Añadir Producto al Pedido">
        <form onSubmit={confirmAddItem} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-text/60 mb-2 uppercase tracking-wide">Receta / Producto</label>
            <select value={itemReceta} onChange={e=>setItemReceta(e.target.value)} className="w-full p-3 border-2 border-borderr bg-background rounded-lg font-bold outline-none focus:border-accent">
              {board.recetas?.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text/60 mb-2 uppercase tracking-wide">Multiplicador (Lotes / Unidades)</label>
            <input type="number" step="0.5" value={itemMult} onChange={e=>setItemMult(e.target.value)} className="w-full p-3 border-2 border-borderr bg-background rounded-lg font-bold outline-none focus:border-accent" />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModalItemAbierto(null)} className="font-bold px-5 py-2 hover:bg-border/50 rounded-lg text-text/60">Cerrar</button>
            <button type="submit" disabled={!itemReceta || !itemMult} className="font-bold px-5 py-2 bg-accent text-white rounded-lg disabled:opacity-50 shadow-md">Añadir</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
