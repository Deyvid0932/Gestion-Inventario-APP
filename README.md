# Gestión de Inventario App 📦📱

Aplicación móvil desarrollada en **React Native (Expo)** para la gestión, organización y escaneo de inventarios de prendas, diseñada para ofrecer un alto rendimiento, diseño fluido (60-120 FPS) y capacidades offline.

## 🛠 Tecnologías Principales (Tech Stack)

- **Framework:** React Native con [Expo](https://expo.dev/)
- **Lenguaje:** TypeScript
- **Base de Datos:** SQLite (`expo-sqlite`) - 100% Offline y local
- **Estado Global:** Zustand (Gestión rápida y ligera de estados y temas)
- **Navegación:** React Navigation v7 (Stack & Bottom Tabs)
- **Gestos y Animaciones:** `react-native-reanimated` y `react-native-gesture-handler`
- **OCR:** Escaneo de textos mediante cámara (`@react-native-ml-kit/text-recognition`)
- **Procesamiento de Imágenes:** `expo-image-picker`, `expo-image-manipulator` (Compresión y redimensionamiento dinámico)

---

## 📂 Arquitectura del Proyecto

El código fuente está estructurado de manera modular dentro del directorio `src/`:

```text
src/
├── components/     # Componentes visuales reutilizables (PrendaCard, Navbar, SearchBar, SkeletonLoader)
├── database/       # Configuración, creación de tablas y sistema de migraciones de SQLite
├── hooks/          # Custom hooks para lógica de negocio (usePrenda, useOCRManager)
├── navigation/     # Configuración del Stack de navegación y rutas
├── screen/         # Pantallas principales (Inventarios, Cajas, Prendas, Formularios, History)
├── services/       # Interacción con la base de datos (InventarioService, CajaService, PrendaService)
├── store/          # Estado global usando Zustand (useAppStore: Temas, Selección múltiple)
└── types/          # Definiciones estáticas e Interfaces de TypeScript
```

---

## ✨ Características Principales (Features)

1. **Gestión Jerárquica:**
   - **Lotes de Trabajo (Inventarios):** Agrupación principal.
   - **Cajas:** Subdivisiones dentro de cada lote con capacidad de reordenamiento (Drag & Drop).
   - **Prendas:** Unidades finales con detalles de OP, Estilo, Color, Estado y Fotografía.

2. **Cámara y OCR Inteligente:**
   - Escaneo de texto con la cámara para rellenar automáticamente los campos del formulario.
   - Captura de fotos cuadradas para cada prenda con recortes automáticos.

3. **Optimizaciones de Rendimiento (Stress-Tested):**
   - **Listas de Alto Rendimiento:** Uso avanzado de `FlatList` con unmontado inteligente (`removeClippedSubviews`, renderizado en lotes, window sizes reducidos) capaz de mantener >80 FPS con 500+ ítems con imágenes en pantalla.
   - **Compresión de Imágenes:** Las fotos tomadas se redimensionan a 600x600 y se comprimen al 80% en formato JPEG para mantener nitidez extrema pesando menos de 80 KB.
   - **Protección Anti-Ghosting (Debounce):** Navegación asegurada con un delay nativo de 400ms para evitar sobreposición de pantallas en toques dobles accidentales.

4. **Experiencia de Usuario (UX/UI):**
   - Diseño moderno sin bordes innecesarios, maximizando el espacio de lectura.
   - Motor de Temas dinámico (Soporte Dark Mode / Light Mode).
   - Animaciones fluidas, Skeleton Loaders durante la carga de base de datos.
   - Eliminación por gesto (Swipe-to-delete) y Selección múltiple (Long Press).

---

## 🚀 Instalación y Uso Local

Para arrancar el proyecto en un entorno de desarrollo:

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Arranca el servidor de Expo:
   ```bash
   npm start
   ```

3. Presiona `a` para abrir en Android (requiere emulador o dispositivo conectado), o escanea el código QR con la aplicación **Expo Go** en tu celular.
