# Manual de Compilación, Despliegue y Android — Topytop Kith

## 1. Configuración de Compilación con EAS Build (`eas.json`)

La aplicación utiliza **EAS Build (Expo Application Services)** para generar paquetes ejecutables binarios de Android (.APK) directamente en la nube.

```json
{
  "cli": {
    "version": ">= 18.4.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Comandos de Compilación
* **Generar APK para Pruebas / QA:**
  ```bash
  eas build -p android --profile preview
  ```
* **Generar APK de Producción:**
  ```bash
  eas build -p android --profile production
  ```

---

## 2. Especificación de Iconos de la Aplicación y Zona Segura (*Safe Zone*)

### 2.1. Configuración del Icono Adaptativo de Android en `app.json`
Android 8.0+ utiliza iconos adaptativos divididos en dos capas: capa de primer plano (*Foreground*) y capa de fondo (*Background*).

```json
"android": {
  "package": "com.deyvid.inventarioapp.supabase",
  "adaptiveIcon": {
    "foregroundImage": "./assets/android_icon_foreground-01.png",
    "backgroundColor": "#000000"
  }
}
```

### 2.2. Reglas Críticas de Diseño
* **Color de Fondo Negro (`#000000`):** La imagen de primer plano `android_icon_foreground-01.png` contiene la letra **`t` en color blanco** con un trazo rojo. Al configurar `backgroundColor: "#000000"`, la letra `t` destaca con contraste óptimo. *(Si se configurase blanco `#FFFFFF`, la letra `t` resultaría invisible).*
* **Zona Segura del 66% (*Safe Zone*):** Los lanzadores de Android recortan los iconos en diversas formas geométricas (círculos, cuadrados redondeados, lágrimas). Todo el arte esencial (la letra `t` y el acento rojo) debe ubicarse dentro de un círculo central que abarque como máximo el **66% del lienzo de 1024x1024 px** para evitar cortes indeseados.

### 2.3. Pantalla de Bienvenida (*Splash Screen*)
```json
"splash": {
  "image": "./assets/splash_icon.png",
  "resizeMode": "contain",
  "backgroundColor": "#000000"
}
```
Mantiene consistencia estética total con el tema oscuro de arranque y el logotipo corporativo.

---

## 3. Permisos Nativos y Reglas de Proguard

### 3.1. Permisos en `app.json`
* `CAMERA`: Requerido para captura fotográfica de prendas y escaneo de etiquetas con Google ML Kit.
* `RECORD_AUDIO`: Requerido por el motor de voz y dictado del chatbot.
* `SCHEDULE_EXACT_ALARM` & `USE_EXACT_ALARM`: Permite programar recordatorios de prendas a horas exactas de producción.
* `VIBRATE`: Retroalimentación háptica en escaneos exitosos y alarmas.
* `POST_NOTIFICATIONS`: Notificaciones locales en Android 13+.

### 3.2. Reglas de Proguard para Google ML Kit
Para evitar que el optimizador de código de Android (*R8 / Proguard*) elimine por error las clases nativas de detección de texto durante la compilación de producción, se configuran las directivas mediante `expo-build-properties`:

```json
[
  "expo-build-properties",
  {
    "android": {
      "extraProguardRules": "-keep class com.google.mlkit.** { *; }\n-dontwarn com.google.mlkit.**\n-keep class com.google.android.gms.internal.mlkit.** { *; }\n-dontwarn com.google.android.gms.internal.mlkit.**\n-keep class com.reactnativemlkit.** { *; }\n-dontwarn com.reactnativemlkit.**"
    }
  }
]
```

---

## 4. Gestión de Variables de Entorno en Compilación en la Nube

Para evitar el error `unconfigured.supabase.co` (`DNS_PROBE_FINISHED_NXDOMAIN`):

1. **Aislamiento en `.gitignore`:** El archivo `.env` local permanece siempre ignorado por Git para proteger las claves de cualquier repositorio público.
2. **Empaquetado en `.easignore`:** Se permite que EAS Build empaquete el archivo `.env` de tu máquina local al momento de compilar el APK.
3. **Alternativa en la Nube:** Si compilas desde entornos CI/CD (GitHub Actions), puedes subir las variables directamente a EAS con el comando:
   ```bash
   npx eas env:create --scope project --env-file .env
   ```

---

## 5. Guía de Diagnóstico y Comandos de Soporte

| Escenario | Comando / Acción | Explicación |
| :--- | :--- | :--- |
| **Verificar APIs de Supabase** | `npx supabase functions list` | Lista el estado de las Edge Functions desplegadas (`upload-photo`). |
| **Verificar Secretos en Supabase**| `npx supabase secrets list` | Lista los secretos activos de Cloudflare R2 en el backend. |
| **Verificar Migraciones SQL** | `npx supabase migration list` | Compara las tablas locales con la base en la nube. |
| **Verificar Dispositivo USB** | `adb devices` | Comprueba que el teléfono esté conectado con depuración USB activa. |
| **Inspeccionar Logs de la App** | `adb logcat \| findstr -i "Topytop"` | Muestra los registros y mensajes de error en tiempo real. |
| **Instalar APK por Terminal** | `adb install -r ruta/a/tu_app.apk` | Instala o actualiza el APK sin perder datos locales de SQLite. |
