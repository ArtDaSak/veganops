export interface Insumo {
  id: string;
  nombre: string;
  unidad: string;
  esCompuesto: boolean;
  subInsumos?: { insumoId: string; cantidad: number }[];
  creadoPor?: string;
}

export interface IngredienteReceta { 
  insumoId: string; 
  cantidad: number; 
}

export interface Receta { id: string; nombre: string; ingredientes: IngredienteReceta[]; pasos: string[]; notas: string; creadoPor?: string; editadoPor?: string; fechaEdicion?: string; }
export interface ChecklistItem { id: string; texto: string; hecho: boolean; }
export interface Tarjeta { id: string; columnaId: string; titulo: string; descripcion: string; etiquetas: string[]; asignados: string[]; checklists: { titulo: string; items: ChecklistItem[] }[]; creadoPor?: string; editadoPor?: string; fechaEdicion?: string; }
export interface Columna { id: string; titulo: string; orden: number; }
export interface PedidoItem { recetaId: string; multiplicador: number; }
export interface Pedido { 
  id: string; 
  cliente: string; 
  fecha: string; 
  estado: 'Pendiente' | 'Preparación' | 'En transporte' | 'Entregado'; 
  tipoPedido?: 'Tienda' | 'Llevar'; 
  direccion?: string; 
  items: PedidoItem[]; 
  creadoPor?: string; 
  editadoPor?: string; 
  fechaEdicion?: string;
}
export interface Enlace { id: string; url: string; titulo: string; creadoPor?: string; }

export interface TableroData { version: number; columnas: Columna[]; tarjetas: Tarjeta[]; recetas: Receta[]; pedidos: Pedido[]; enlaces: Enlace[]; insumos: Insumo[]; }
