# 🌱 VeganOps

> **El ecosistema definitivo de gestión Multi-Tienda y Tableros Operativos orientado a redes de restaurantes plant-based.**

VeganOps es una plataforma BVB (Business-View-Board) colaborativa en tiempo real construida sobre **Next.js 14**, **Tailwind CSS**, y el poderoso entorno sin servidor de red de **Google Drive API**. Permite interconectar el trabajo del equipo base de cocina (Recetas, Pedidos, Kanban) con una escala de permisos inteligente administrada desde la nube de corporativa.

---

## 🚀 Características Principales

- **⚡ Hub Global**: Inicio de sesión _Single Sign-On_ vía Google. Sincroniza configuraciones y permisos automáticamente.
- **🛠️ Arquitectura Híbrida de Almacenamiento**: Persistencia inteligente en Google Drive. No existen bases de datos de terceros; tú eres dueño absoluto de cada bit generado en formato JSON local dentro de tus carpetas corporativas.
- **🛡️ Role-Based Access Control (RBAC)**: Sistema de seguridad de triple capa garantizando blindaje operativo según el nivel del usuario asignado:
  1.  **Admin Global**: Omnipresente. Crea Franquicias (Sucursales) globales y otorga permisos de visibilidad para cada rol. Edita las _Recetas_ e _Insumos Base_ corporativos.
  2.  **Director**: Líder de sucursal. Asigna "Coordinadores" y "Trabajadores" para las propiedades físicas donde fue asignado. Visualiza el total de la producción para sus tiendas.
  3.  **Coordinador**: Administra tableros operativos _per-franquicia_. Puede crear y borrar tableros para organizar las áreas operativas (Ej: _Cocina Caliente_, _Despacho_).
  4.  **Trabajador**: Experiencia optimizada de Solo-Lectura. Maneja la pantalla interactiva principal pero carece de perfiles destructivos de administración.
- **🔌 Real-time Board (WebSockets con Supabase)**: Visualización y colisión bidireccional instantánea al arrastrar tarjetas, editar recetas o cambiar progreso de pedidos online.
- **📱 Mobile-First Next.js Responsive**: Interfaz enteramente diseñada por módulos adaptables de _TailwindCSS_ listos para operar en la Tablet/IPad de la cocina o el celular del supervisor.
- **🎨 Dynamic Theming**: Toggle nativo interactivo optimizado para visualizar los flujos en texturas orgánicas (`corcho vegano`) o diseños `limpios ultra modernos`.

---

## 💻 Entorno de Desarrollo (Local Setup)

Se han solucionado los conflictos de dependencias históricos y limpiado iterativamente la caché del servidor Node.js en esta versión estable (`V1.0`). Sigue los siguientes pasos para levantar VeganOps:

### 1. Prerrequisitos

- **Node.js**: `v18.17.0` o superior.
- **Google Cloud Console**: Un _Project ID_ activo que cuente con credenciales OAuth 2.0 y tenga habilitada la librería `Google Drive API` de alcance masivo (`auth/drive`).
- **Supabase**: Un proyecto con la API pública y el canal WebSocket habilitado.

### 2. Variables de Entorno (`.env.local`)

Clona el repositorio y en la raíz crea (o modifica) un archivo `.env.local` que contenga exactamente estas firmas autorizadas:

```env
GOOGLE_CLIENT_ID="<tu-google-client-id>"
GOOGLE_CLIENT_SECRET="<tu-google-secret>"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<tu-secreto-base64>"

NEXT_PUBLIC_SUPABASE_URL="<tu-supabase-url>"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<tu-supabase-annon>"
```

### 3. Instalación de Dependencias

```bash
npm install
# Nota: La base de autenticación asíncrona NextAuth podría requerir validación explícita de peer-dependencies de React si migras Next.js.
```

### 4. Entorno de Ejecución (Desarrollo)

```bash
# Limpiar caché previa de empaquetado (Para mitigar posibles errores 276.js HMR)
rm -rf .next
# Iniciar Pipeline Frontal
npm run dev
```

La aplicación estará transmitiendo en `http://localhost:3000`.

---

## 🛠 Entendiendo el Ciclo del "Ghost Board" (V8.6 Hotfix)

Si a lo largo del tiempo notas que surgen tableros sin sentido o el sistema "parece perder la sucursal", se debe al retardo nativo asincrónico del Sandbox de Drive al conceder permisos. Hemos programado una herramienta oficial **"Limpiar Fantasmas"** que hallarás en la Central Operativa _(Página de Tableros)_ al ingresar como Super Admin. Bastará con pulsarla para que los colectores de basura paralelos reciclen los tableros obsoletos de `.json`.

## 📌 Autor

Desarrollado para la revolución **Plant-Based**. Creado en conjunto con el ecosistema de IA _Antigravity_.  
_Licencia MIT._
