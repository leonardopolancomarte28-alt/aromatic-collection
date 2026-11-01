# GUÍA DE PUBLICACIÓN EN INTERNET Y ALOJAMIENTO EN LA NUBE
## PLATAFORMA DE GESTIÓN PARA NEGOCIO DE PERFUMES BAJO PEDIDO (RD$)

Esta guía está diseñada para que puedas tener tu plataforma funcionando **24 horas al día, 7 días a la semana en internet**, sin depender de mantener encendida tu computadora personal, para que tus vendedores y tú puedan conectarse desde sus celulares en cualquier lugar del país.

---

### Opción 1: Enlace Público Inmediato (Ya activo)

Para que puedas hacer pruebas hoy mismo desde cualquier celular sin costo:

- **Enlace web público en internet:** **`https://luxeperfumes-rd.loca.lt`**
- **Contraseña de verificación del túnel (si la solicita la primera vez):** `38.252.230.233`
- **Tus credenciales:**
  - Admin: `admin@perfumes.com` | `Admin123456!`
  - Vendedor: `vendedor1@perfumes.com` | `Vendedor123456!`

---

### Opción 2: Publicación Permanente en la Nube (Render.com)

**Render** es la opción más recomendada para negocios pequeños y en crecimiento porque incluye:
- Certificado de seguridad **HTTPS (candado verde)** gratuito y automático.
- Servidor disponible 24/7.
- Disco de almacenamiento persistente para la base de datos `perfumes.db`.
- Soporte para conectar tu propio dominio (ejemplo: `pedidos.tumarca.com`).

#### Archivos ya preparados en tu proyecto:
Ya dejamos listos los siguientes archivos en la carpeta de tu proyecto:
1. `Dockerfile`: Empaqueta toda la plataforma con Node.js y la base de datos.
2. `render.yaml`: Plano de configuración que activa el servidor y el disco persistente de 1 GB.
3. `.dockerignore` y `.gitignore`: Excluyen archivos temporales y protegen la seguridad.

#### Pasos para publicar en Render (Sin escribir código):
1. Crea una cuenta gratuita en **[Render.com](https://render.com)** (puedes registrarte con tu correo de Google).
2. Sube la carpeta de tu proyecto a una cuenta gratuita de **[GitHub.com](https://github.com)** o conecta tu repositorio.
3. En Render, presiona **"New +"** y selecciona **"Web Service"**.
4. Selecciona tu repositorio de la plataforma de perfumes.
5. Render detectará automáticamente el archivo `Dockerfile` y `render.yaml`.
6. En la sección **Disks**, confirma un disco persistente montado en `/app/data` (para que los pedidos, clientes y caja nunca se borren).
7. Presiona **"Create Web Service"**.
8. En 2 minutos, Render te entregará una dirección web permanente del tipo:
   `https://luxeperfumes-gestion.onrender.com`

---

### Opción 3: Publicación en Railway.app

**Railway** es otra alternativa excelente y muy veloz:
1. Entra a **[Railway.app](https://railway.app)** e inicia sesión con GitHub o tu correo.
2. Presiona **"New Project"** $\rightarrow$ **"Deploy from GitHub repo"**.
3. Selecciona tu proyecto de perfumes.
4. El archivo ya incluido `railway.json` configurará el inicio automático.
5. En la pestaña de configuración del servicio, agrega un **Volume** montado en `/app/data`.
6. Presiona **"Generate Domain"** y tendrás tu enlace público de inmediato.

---

### Costos Estimados de Operación:
- **Pruebas y Uso Local / Enlace Temporal:** **US$ 0.00** (Totalmente gratuito).
- **Servidor Cloud 24/7 (Render o Railway Starter):** Aprox. **US$ 5.00 a US$ 7.00 al mes**.
- **Dominio Propio opcional (ej. `gestiongrupoperfumes.com`):** Aprox. **US$ 12.00 al año** (vía Namecheap, Google Domains / Squarespace o Cloudflare).
