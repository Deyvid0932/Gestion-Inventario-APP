# Topytop Kith — Sistema Móvil de Control y Gestión de Inventario Textil 📦🧵

<<<<<<< HEAD
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
=======
Aplicación móvil de grado industrial desarrollada con **React Native (Expo SDK 55)** y **TypeScript** para la trazabilidad, auditoría, clasificación y gestión de prendas textiles en tiempo real. 

Diseñada bajo una arquitectura estricta **Offline-First**, la aplicación opera de forma instantánea sobre una base de datos local **SQLite** (WAL mode), sincronizando de manera bidireccional y sin bloqueos de interfaz con **Supabase (PostgreSQL)**, almacenando evidencia fotográfica en **Cloudflare R2** y asistiendo a los operarios mediante un motor de **OCR Híbrido** y un **Asistente de Lenguaje Natural impulsado por Google Gemini**.
>>>>>>> develop

---

## 📚 Documentación Técnica Detallada

<<<<<<< HEAD
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
=======
Para una inmersión profunda en la arquitectura, esquemas y componentes, consulta los manuales especializados ubicados en la carpeta [`docs/`](file:///c:/Users/Deyvi/Desktop/Guardar-Cosas/Dev/Inventario_App/Inventario_frontend-App/docs/):

| Manual Técnico | Descripción y Contenido Clave | Enlace |
| :--- | :--- | :---: |
| **Arquitectura del Sistema** | Patrón Offline-First, ciclo de vida de sincronización, Zustand, navegación y diseño Claymorphism. | [Ver Manual](file:///c:/Users/Deyvi/Desktop/Guardar-Cosas/Dev/Inventario_App/Inventario_frontend-App/docs/ARQUITECTURA.md) |
| **Base de Datos y Esquemas** | Esquema SQLite v3, PRAGMA WAL, diccionario de tablas, índices de alta velocidad y esquemas Supabase. | [Ver Manual](file:///c:/Users/Deyvi/Desktop/Guardar-Cosas/Dev/Inventario_App/Inventario_frontend-App/docs/BASE_DE_DATOS.md) |
| **IA, OCR y Multimedia** | Pipeline OCR híbrido (ML Kit 150ms + Gemini Flash Lite 700ms), Chatbot NLP y Cloudflare R2 sin egress fees. | [Ver Manual](file:///c:/Users/Deyvi/Desktop/Guardar-Cosas/Dev/Inventario_App/Inventario_frontend-App/docs/IA_Y_OCR.md) |
| **Roles, Permisos y Seguridad** | Matriz de control RBAC (`Admin`, `Editor`, `Viewer`), `RoleGuard`, ciclo de cuenta y variables de entorno. | [Ver Manual](file:///c:/Users/Deyvi/Desktop/Guardar-Cosas/Dev/Inventario_App/Inventario_frontend-App/docs/ROLES_Y_SEGURIDAD.md) |
| **Operaciones Masivas y Excel** | Inserción atómica SQLite de 629 prendas (<1s), motor de exportación XLSX multi-hoja y papelera. | [Ver Manual](file:///c:/Users/Deyvi/Desktop/Guardar-Cosas/Dev/Inventario_App/Inventario_frontend-App/docs/OPERACIONES_Y_EXCEL.md) |
| **Compilación y Android** | Perfiles EAS Build (.APK), zona segura de iconos adaptativos (Safe Zone 66%), Proguard y ADB. | [Ver Manual](file:///c:/Users/Deyvi/Desktop/Guardar-Cosas/Dev/Inventario_App/Inventario_frontend-App/docs/DESPLIEGUE_Y_BUILD.md) |

---

## 🛠 Tecnologías Principales (Tech Stack)

* **Framework Base:** [Expo](https://expo.dev/) (SDK 55) con React Native 0.83 y React 19.
* **Lenguaje:** TypeScript 5.9 con tipado estricto.
* **Almacenamiento Local:** SQLite con `expo-sqlite` (Modo WAL y claves foráneas activas).
* **Nube y Backend:** [Supabase](https://supabase.com/) (Postgres Cloud, Supabase Auth y Row Level Security).
* **Almacenamiento de Medios:** [Cloudflare R2 Bucket](https://www.cloudflare.com/developer-platform/r2/) con Supabase Edge Functions (`upload-photo`).
* **Inteligencia Artificial:** Google Gemini 2.5 Flash Lite (`@google/genai`) y Google ML Kit (`@react-native-ml-kit/text-recognition`).
* **Gestión de Estado:** [Zustand 5](https://github.com/pmndrs/zustand) con sincronización reactiva síncrona.
* **Navegación:** React Navigation v7 (Stack Navigator & Bottom Tabs).
* **Motor de Excel:** SheetJS (`xlsx`), `expo-file-system` y `expo-sharing`.
* **Notificaciones y Alarmas:** `expo-notifications` con canales de audio de prioridad máxima en Android.
* **Estilizado y Animaciones:** `react-native-reanimated`, `react-native-gesture-handler` y componentes *Claymorphism*.

---

## ✨ Características Principales

### 1. Gestión Jerárquica Textil en Tiempo Real
* **Lotes de Trabajo (`inventories`):** Agrupación por campaña, temporada u orden textil.
* **Cajas Físicas (`boxes`):** Contenedores ordenables mediante arrastrar y soltar (*Drag & Drop*).
* **Prendas Textiles (`garments`):** Control exhaustivo de Orden de Producción (OP), Estilo (KH), Color, Talla, Estado y evidencia fotográfica doble.

### 2. Motor de OCR Textil Híbrido Ultra Rápido
* **150 ms en el dispositivo:** Extracción local de caracteres mediante aceleración por hardware con Google ML Kit.
* **Estructuración con Gemini:** Convierte el texto plano en JSON normalizado de prendas corrigiendo errores tipográficos en 700 ms.
* **Fallback 100% Offline:** Extracción con expresiones regulares deterministas si el dispositivo no cuenta con internet.

### 3. Sincronización Silenciosa y Ruedita Discreta
* Carga inmediata de pantallas en milisegundos desde SQLite sin pantallas de bloqueo.
* Indicador giratorio minimalista en la barra superior (`Navbar`) que notifica cuándo se están respaldando datos con Supabase sin interrumpir el trabajo del operario.

### 4. Control de Acceso Granular (RBAC)
* **Admin (👑):** Control total, auditoría, vaciado permanente de papelera y asignación de permisos a usuarios.
* **Editor (✏️):** Registro de inventario, escaneo OCR, edición y toma de fotos.
* **Viewer (👁️):** Acceso seguro de solo lectura para supervisores e inspectores de calidad.

### 5. Importación y Exportación Masiva
* **Semilla Pre-cargada:** Carga 629 prendas y 21 cajas en menos de un segundo gracias a transacciones atómicas en SQLite.
* **Exportación Excel Personalizada:** Descarga reportes `.xlsx` organizando cada caja física en pestañas independientes o en una hoja agrupada.

---

## 📂 Estructura del Código Fuente

```text
Inventario_frontend-App/
├── assets/                  # Iconos adaptativos (1024x1024), splash screen y logos
├── docs/                    # Manuales técnicos y guías de arquitectura
│   ├── ARQUITECTURA.md
│   ├── BASE_DE_DATOS.md
│   ├── IA_Y_OCR.md
│   ├── ROLES_Y_SEGURIDAD.md
│   ├── OPERACIONES_Y_EXCEL.md
│   └── DESPLIEGUE_Y_BUILD.md
├── src/
│   ├── components/          # Componentes modulares (Navbar, Cards, Modales, RoleGuard)
│   ├── data/                # Dataset inicial de semillas (initialInventorySeed)
│   ├── database/            # Esquema SQLite, migraciones canónicas y cliente Supabase
│   ├── hooks/               # Custom hooks de reactividad y escaneo OCR
│   ├── navigation/          # React Navigation v7 (Tabs y Stacks)
│   ├── screens/             # Pantallas (Dashboard, Lotes, Cajas, Prendas, Form, Chat, etc.)
│   ├── services/            # Servicios de negocio (Inventario, Auth, IA, Cloudflare R2, Alarmas)
│   ├── store/               # Zustand store global (useAppStore)
│   ├── styles/              # Tokens de diseño, 6 paletas de color y clayStyles
│   ├── sync/                # Motor de sincronización bidireccional y adaptadores
│   ├── types/               # Modelos de datos TypeScript y contratos de interfaz
│   └── utils/               # Parsers OCR, motor de exportación Excel y algoritmos NLP
├── supabase/                # Migraciones de base de datos PostgreSQL y Edge Functions (Deno)
├── app.json                 # Manifiesto de Expo, permisos de Android y configuración de iconos
├── eas.json                 # Perfiles de compilación EAS para generación de APK
└── package.json             # Dependencias del ecosistema
>>>>>>> develop
```

---

## 🚀 Puesta en Marcha Local

<<<<<<< HEAD
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
=======
### Prerrequisitos
* Node.js v18 o superior.
* Gestor de paquetes `npm`.
* Dispositivo físico Android con depuración USB activa o emulador configurado.

### Instalación y Ejecución
1. Clona el repositorio e instala las dependencias:
   ```bash
   npm install
   ```
2. Inicia el servidor de desarrollo de Metro:
>>>>>>> develop
   ```bash
   npx expo start
   ```
3. Presiona `a` en la terminal para desplegar en tu dispositivo Android conectado.

<<<<<<< HEAD
3. Presiona `a` para abrir en un emulador Android, o escanea el código QR con la aplicación **Expo Go** en tu dispositivo físico.
=======
---

## 📱 Compilación del APK para Producción

Para generar el archivo ejecutable `.apk` instalable en cualquier dispositivo Android:

```bash
eas build -p android --profile production
```
*(Nota: El archivo `.easignore` está configurado para que EAS incluya tus variables de entorno locales de forma segura durante la compilación).*
>>>>>>> develop
