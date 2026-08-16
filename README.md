# Gestión de Inventario App 📦📱

Aplicación móvil desarrollada en **React Native (Expo)** para la gestión, organización y control de inventarios de prendas textiles en tiempo real. Diseñada bajo una arquitectura **Offline-First** ultra rápida (60-120 FPS), integrada con sincronización en la nube mediante **Supabase**, almacenamiento optimizado de fotografías en **Cloudflare R2**, control de acceso basado en **Roles (RBAC)**, un **Asistente de IA (Groq Llama 3.3 70B)** y **Métricas Interactivas en el Dashboard**.

---

## 🛠 Tecnologías Principales (Tech Stack)

- **Framework:** React Native con [Expo](https://expo.dev/) (SDK 55)
- **Lenguaje:** TypeScript
- **Base de Datos Local:** SQLite (`expo-sqlite`) - Operación 100% Offline-First
- **Nube y Autenticación:** [Supabase](https://supabase.com/) (Postgres Cloud, Supabase Auth, Row Level Security - RLS)
- **Almacenamiento de Fotografías:** [Cloudflare R2 Bucket](https://www.cloudflare.com/developer-platform/r2/) + Supabase Edge Functions (`upload-photo`)
- **Inteligencia Artificial:** Groq Cloud AI (`llama-3.3-70b-versatile`)
- **Métricas & Gráficos:** `react-native-chart-kit` y `react-native-svg`
- **Estado Global:** Zustand (Gestión rápida de temas y selección múltiple)
- **Navegación:** React Navigation v7 (Stack & Bottom Tabs)
- **Gestos y Animaciones:** `react-native-reanimated` y `react-native-gesture-handler`
- **OCR:** Escaneo de etiquetas de prendas con cámara (`@react-native-ml-kit/text-recognition`)
- **Procesamiento de Imágenes:** `expo-image-picker`, `expo-image-manipulator`

---

## ☁️ Arquitectura de Almacenamiento de Fotografías (Cloudflare R2 + Supabase)

Para evitar costos elevados de transferencia de datos (*egress fees*) y optimizar la base de datos Postgres en Supabase, la aplicación utiliza una estrategia combinada de almacenamiento eficiente:

1. **Captura y Compresión Local**:
   - Al tomar o seleccionar una foto (hasta 2 por prenda), la imagen se redimensiona a **600px de ancho** y se comprime al **50% en formato JPEG**, reduciendo su peso de ~4MB a solo **~80-120 KB**.
2. **Invocación a Supabase Edge Function**:
   - La aplicación envía la imagen comprimida a la Edge Function segura `upload-photo`.
3. **Almacenamiento Físico en Cloudflare R2**:
   - La Edge Function aloja el archivo binario directamente en un Bucket privado de **Cloudflare R2**.
4. **Almacenamiento de String en Supabase**:
   - **Supabase ÚNICAMENTE almacena la clave en formato texto (string)** en las columnas `r2Key` y `r2Key2` de la tabla `garments` (por ejemplo: `prendas/usuario123/prenda_abc_slot1.jpg`). Esto mantiene la base de datos de Supabase ligera y libre de archivos pesados.
5. **Visualización y Caché 100% Offline**:
   - La primera vez que se consulta la imagen desde la nube, se solicita una URL firmada (*Presigned Signed URL*) a Cloudflare R2 y se descarga en segundo plano al almacenamiento permanente del dispositivo (`FileSystem.documentDirectory`).
   - **Disponibilidad Offline**: Cuando el teléfono no tiene internet, las fotos cargan al instante desde el disco local del celular.

---

## 🔐 Autenticación y Control de Acceso por Roles (RBAC)

La aplicación cuenta con autenticación de usuarios mediante **Supabase Auth** y un sistema de control de permisos de 3 niveles manejado con el componente protector `RoleGuard`:

| Rol | Icono | Permisos y Capacidades |
| :--- | :---: | :--- |
| **Admin** | 👑 | **Acceso Total:** Crear, editar, eliminar lotes, cajas y prendas; gestionar usuarios y asignar roles; vaciar la papelera de reciclaje y realizar eliminaciones definitivas. |
| **Editor** | ✏️ | **Creación y Edición:** Crear y modificar datos en Lotes, Cajas y Prendas; escaneo OCR y adjuntar fotografías. No puede gestionar usuarios ni vaciar la papelera. |
| **Viewer** | 👁️ | **Modo de Solo Lectura:** Puede navegar por todas las pantallas, buscar prendas, visualizar reportes y consultar estadísticas. Todas las acciones de edición o borrado quedan bloqueadas o deshabilitadas. |

---

## 🔄 Motor de Sincronización Bidireccional (Offline-First Engine)

La aplicación opera prioritariamente en la base de datos **SQLite local**, garantizando cero latencia al trabajar:

- **Programador de Sincronización (`SyncScheduler`)**:
  - Detecta cambios pendientes en la base de datos local y los envía en segundo plano a Supabase cuando hay conexión.
- **Adaptadores de Sincronización**:
  - `InventarioSyncAdapter`, `CajaSyncAdapter` y `PrendaSyncAdapter` sincronizan de forma bidireccional los registros entre SQLite y Supabase Postgres.
- **Cola de Borrados Offline (`pending_deletions`)**:
  - Si un usuario elimina registros o fotos sin internet, las acciones se encolan para ejecutarse en Cloudflare R2 y Supabase al recuperar la conectividad.

---

## 🤖 Asistente de IA (Groq Cloud Llama 3.3 70B)

Integración conversacional dentro de la sección **Asistente IA**:

- Impulsado por la API de **Groq Cloud AI** ejecutando el modelo `llama-3.3-70b-versatile`.
- Permite hacer preguntas en lenguaje natural sobre el inventario (ej. *"¿Dónde está la prenda de color Azul y OP 12345?"* o *"¿Cuántas cajas hay en el lote Primavera?"*).
- Clasifica automáticamente la intención del usuario y realiza consultas directas a SQLite para entregar respuestas precisas con accesos directos a la ubicación de cada prenda.

---

## 📊 Dashboard y Métricas Interactivas

Pantalla principal (*Inicio / Dashboard*) con visualización de datos mediante `react-native-chart-kit`:

- 📈 **Tendencia de Actividad**: Gráfico de líneas (*Bezier LineChart*) que muestra la evolución de prendas registradas en los últimos 7 días ajustado a la **hora local** del usuario.
- 📦 **Distribución por Cajas**: Gráfico de barras (*BarChart*) con las 5 cajas de mayor volumen.
- 📊 **Proporción de Estado**: Gráfico circular (*PieChart*) que refleja prendas Activas vs. Inactivas.

---

## 📂 Arquitectura del Proyecto

Estructura modular dentro del directorio `src/`:

```text
src/
├── components/     # Componentes visuales reutilizables (PrendaCard, Navbar, SearchBar, SkeletonLoader, RoleGuard, ImagePreviewModal, TrashModal)
├── database/       # Configuración de SQLite local, Supabase client y motor de migraciones
├── hooks/          # Custom hooks de lógica de negocio (usePrenda, useOCRManager)
├── navigation/     # Configuración del Stack de navegación y pestañas
├── screen/         # Pantallas principales (Stats/Inicio, Inventarios, Cajas, CajaContents, Form, History, Trash, Settings, Chatbot)
├── services/       # Lógica de base de datos e integración (InventarioService, CajaService, PrendaService, R2Service, ChatbotService, StatsService)
├── store/          # Estado global Zustand (useAppStore: Temas, selección múltiple, sincronización)
├── sync/           # Adaptadores del motor de sincronización bidireccional SQLite <-> Supabase
├── style/          # Sistema de diseño, temas visuales y tokens de estilo (clayStyles)
├── types/          # Interfaces y definiciones de TypeScript
└── utils/          # Utilidades (colorUtils, maskUtils, ocrParser, exportToExcel, uuid)
```

---

## ✨ Características Principales (Features)

1. **Gestión Jerárquica:**
   - **Lotes de Trabajo (Inventarios):** Agrupación principal con reordenamiento personalizado.
   - **Cajas:** Subdivisiones dentro de cada lote con capacidad de reordenamiento (Drag & Drop con `react-native-draggable-flatlist`).
   - **Prendas:** Registros individuales con OP, Estilo, Color, Estado, Alarma programada y hasta 2 Fotógrafos.

2. **Cámara y OCR Inteligente:**
   - Reconocimiento automático de texto en etiquetas textiles para autocompletar formularios.
   - Captura de fotos cuadradas optimizadas con compresión inmediata.

3. **Optimizaciones de Rendimiento:**
   - **Listas de Alto Rendimiento:** `FlatList` optimizada manteniendo >60-120 FPS incluso en listas extensas.
   - **Compresión de Imágenes:** Fotos procesadas a 600px JPEG 50% (~80 KB por foto).
   - **Protección Anti-Ghosting:** Navegación asegurada con debounce nativo.

4. **Experiencia de Usuario (UX/UI):**
   - Motor de Temas dinámico (Soporte Dark Mode / Light Mode).
   - Animaciones fluidas con `react-native-reanimated`.
   - Eliminación por gesto (*Swipe-to-delete*) y Selección múltiple (*Long Press*).
   - Exportación de reportes completos a **Microsoft Excel (`.xlsx`)**.

---

## 🚀 Instalación y Uso Local

Para ejecutar el proyecto localmente:

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Inicia el servidor de desarrollo de Expo:
   ```bash
   npm start
   ```

3. Presiona `a` para abrir en un emulador Android, o escanea el código QR con la aplicación **Expo Go** en tu dispositivo físico.
