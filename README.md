# Topytop Kith — Sistema Móvil de Control y Gestión de Inventario Textil 📦🧵

Aplicación móvil de grado industrial desarrollada con **React Native (Expo SDK 55)** y **TypeScript** para la trazabilidad, auditoría, clasificación y gestión de prendas textiles en tiempo real. 

Diseñada bajo una arquitectura estricta **Offline-First**, la aplicación opera de forma instantánea sobre una base de datos local **SQLite** (WAL mode), sincronizando de manera bidireccional y sin bloqueos de interfaz con **Supabase (PostgreSQL)**, almacenando evidencia fotográfica en **Cloudflare R2** y asistiendo a los operarios mediante un motor de **OCR Híbrido** y un **Asistente de Lenguaje Natural impulsado por Google Gemini**.

---

## 📚 Documentación Técnica Detallada

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
```

---

## 🚀 Puesta en Marcha Local

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
   ```bash
   npx expo start
   ```
3. Presiona `a` en la terminal para desplegar en tu dispositivo Android conectado.

---

## 📱 Compilación del APK para Producción

Para generar el archivo ejecutable `.apk` instalable en cualquier dispositivo Android:

```bash
eas build -p android --profile production
```
*(Nota: El archivo `.easignore` está configurado para que EAS incluya tus variables de entorno locales de forma segura durante la compilación).*
