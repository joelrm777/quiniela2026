# 🏆 Quiniela Copa Mundial 2026

¡Bienvenido a la aplicación web de la **Quiniela del Mundial 2026**! Esta plataforma es moderna, segura, responsive y fácil de usar, diseñada con una estética glassmórfica premium para brindar una experiencia inmersiva.

---

## 🛠️ Tecnologías Utilizadas

- **Backend**: FastAPI (Python 3.13.7) - Rápido, moderno, asíncrono y seguro.
- **Base de Datos**: SQLite3 - Base de datos local ligera y autocontenida (`quiniela.db`).
- **Autenticación**: `itsdangerous` - Firma criptográfica segura de tokens para mantener sesiones activas.
- **Seguridad**: Hash de contraseñas mediante **PBKDF2 con SHA256** (módulo `hashlib`).
- **Frontend**: HTML5 semántico, CSS3 avanzado (Variables personalizadas, HSL, Glassmorphism, animaciones fluidas) y Vanilla JavaScript (sin librerías pesadas, carga instantánea).

---

## 🔑 Credenciales de Prueba

La base de datos viene cargada de fábrica con partidos iniciales y cuentas de prueba para facilitar tus pruebas:

### 1. Cuenta de Administrador
- **Usuario**: `admin`
- **Contraseña**: `admin126`
- *Permisos*: Ver y editar pronósticos personales + Acceso al **Panel de Administración** para cargar nuevos partidos, cerrar predicciones y registrar marcadores oficiales.

### 2. Cuentas de Usuario (Competidores)
- **Usuario**: `juan` | **Contraseña**: `juan26`
- **Usuario**: `maria` | **Contraseña**: `maria26`
- *Permisos*: Ver y editar sus propios pronósticos, consultar la tabla de posiciones general e historial personal.

---

## 🧮 Sistema de Puntuación (Mundial 2026)

Los puntos se calculan automáticamente al registrar un resultado real de un partido, sumando las siguientes categorías:

1. **Acierto del Resultado General (Ganador o Empate)**: **+3 puntos**
2. **Acierto del Marcador Exacto**: **+2 puntos** (adicionales)
3. **Acierto de Goles del Equipo Local**: **+1 punto**
4. **Acierto de Goles del Equipo Visitante**: **+1 punto**

### Ejemplos de puntuación (Marcador Real: 2 - 1):
* **Predicción 2 - 1**: Acertó Ganador (3), Marcador Exacto (2), Goles Local (1) y Goles Visitante (1) = **7 puntos** (Puntuación máxima).
* **Predicción 2 - 0**: Acertó Ganador (3), Goles Local (1) = **4 puntos**.
* **Predicción 0 - 1**: Acertó Goles Visitante (1) = **1 punto**.
* **Predicción 0 - 2**: Ningún acierto = **0 puntos**.

---

## ⏱️ Reglas de Bloqueo Automático
- Los pronósticos se **bloquean automáticamente 1 hora antes** de la hora de inicio oficial de cada partido.
- El servidor FastAPI rechaza peticiones de guardado/edición de pronósticos tras cumplirse esta condición de tiempo.
- El cliente web muestra una cuenta regresiva dinámica en tiempo real e inhabilita visualmente los botones e inputs una vez bloqueado.

---

## 🚀 Cómo Iniciar la Aplicación

Para arrancar el servidor en Windows, sigue estos pasos:

1. Asegúrate de estar en el directorio de trabajo del proyecto:
   `C:\Users\eguevara\.gemini\antigravity\scratch\quiniela-mundial`
2. Haz doble clic en el archivo ejecutable **`run.bat`** o ejecútalo desde tu terminal:
   ```cmd
   run.bat
   ```
3. El script de ejecución se encargará de:
   - Abrir automáticamente tu navegador predeterminado en `http://127.0.0.1:8000/`.
   - Iniciar el servidor local API de FastAPI mediante Uvicorn.
4. ¡Listo! Puedes iniciar sesión como `admin` o registrar nuevos usuarios para jugar.
