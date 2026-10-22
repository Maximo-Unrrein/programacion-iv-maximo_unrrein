# MaxSend · Conectá sin límites

Red social (TP #2 · Programación IV) con publicaciones, me gusta, comentarios, perfiles, tendencias,
guardados, compartidos y un dashboard de administración con estadísticas.

| Capa | Tecnología | Carpeta |
| --- | --- | --- |
| Frontend | Angular 22 · Tailwind CSS 4 · three.js (fondos ASCII) · Chart.js · PWA | `frontend/` |
| Backend | NestJS 11 · Mongoose · JWT (15 min) · bcrypt | `backend/` |
| Base de datos | MongoDB 8 (Docker), también guarda las imágenes | `docker-compose.yml` |

## Requisitos

- **Node.js 20 o superior** (probado con Node 24) y npm.
- **Docker Desktop** abierto (para MongoDB). Alternativa: un MongoDB propio o MongoDB Atlas.
- Puertos libres: **4200** (frontend), **3000** (backend) y **27017** (MongoDB).

## Puesta en marcha rápida

```bash
git clone <url-del-repo> maxsend
cd maxsend
cp backend/.env.example backend/.env      # PowerShell: copy backend\.env.example backend\.env
```

Editá `backend/.env` y completá como mínimo:

- `JWT_SECRET`: un texto largo y aleatorio. Generalo con
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `SEED_ADMIN_PASSWORD` y `SEED_USER_PASSWORD`: contraseñas de las cuentas de prueba
  (**8+ caracteres, una mayúscula y un número**).

```bash
npm run setup   # sólo la primera vez: instala todo, levanta MongoDB y carga datos de prueba
npm run dev     # backend (:3000) + frontend (:4200), con la base de `MONGODB_URI` (Atlas)
```

Se abre **http://127.0.0.1:4200**. Cuentas de prueba (las crea el seed):

| Cuenta | Usuario | Contraseña |
| --- | --- | --- |
| Administrador | `admin` | `SEED_ADMIN_PASSWORD` de tu `.env` |
| Usuario | `demo` | `SEED_USER_PASSWORD` de tu `.env` |

`Ctrl+C` corta backend y frontend; MongoDB sigue en Docker (`npm run db:down` lo apaga, los datos se conservan).

| Comando (raíz) | Qué hace |
| --- | --- |
| `npm run setup` | Instala dependencias, levanta MongoDB y corre el seed |
| `npm run dev` | Backend (watch) + frontend, usando la base de `MONGODB_URI` |
| `npm run dev:local` | Igual, pero antes levanta el MongoDB de Docker |
| `npm run seed` | Carga/actualiza los datos de prueba (no duplica) |
| `npm run db:up` / `npm run db:down` | Levanta / apaga MongoDB |

## Paso a paso (sin los comandos de la raíz)

```bash
docker compose up -d                                   # MongoDB
cd backend && npm install && npm run seed && npm run start:dev   # API en http://localhost:3000/api
cd frontend && npm install && npm start                # app en http://127.0.0.1:4200 (otra terminal)
```

Sin Docker: cambiá `MONGODB_URI` en `backend/.env` por la URL de tu MongoDB (por ej. Atlas, ver abajo).

## Usar MongoDB Atlas

1. En [cloud.mongodb.com](https://cloud.mongodb.com) creá un cluster gratis **M0** (región São Paulo, `sa-east-1`).
2. **Database Access** → un usuario de base de datos con rol *Read and write to any database*.
3. **Network Access** → `0.0.0.0/0` (necesario para Vercel; para probar desde tu PC alcanza con *Add current IP*).
4. **Connect → Drivers** → copiá la cadena y agregale el nombre de la base:
   `mongodb+srv://USUARIO:CONTRASEÑA@CLUSTER.xxxxx.mongodb.net/maxsend?retryWrites=true&w=majority`
   (si la contraseña tiene `@ : / ? # %`, codificalos o generá una sin esos caracteres).
5. Pegala en `MONGODB_URI` de `backend/.env` y cargá los datos de prueba:

```bash
cd backend && npm run seed && npm run start:dev
```

`npm run dev` no necesita Docker; para volver al Mongo local, poné la URI local en `.env` y usá `npm run dev:local`.

## Deploy en Vercel

Dos proyectos de Vercel sobre el mismo repo:

- **Backend** (Root Directory `backend`): NestJS como Vercel Function, sin configuración extra.
- **Frontend** (Root Directory `frontend`): Angular estático. `frontend/vercel.json` reenvía `/api/...` al
  backend, así el navegador usa un solo dominio y no hace falta CORS.

1. En Atlas → **Network Access**, agregá `0.0.0.0/0` (Vercel no tiene IPs fijas).
2. **Backend:** *Add New Project* → este repo → Root Directory `backend` (preset NestJS). Variables:

   | Variable | Valor |
   | --- | --- |
   | `MONGODB_URI` | La cadena de Atlas (con `/maxsend`) |
   | `JWT_SECRET` | Uno nuevo de 32+ caracteres: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `JWT_EXPIRES_IN` | `15m` |

   Recomendado: *Settings → Functions → Region* → São Paulo (`gru1`), cerca de Atlas.
3. Poné la URL del backend en `frontend/vercel.json` (ya configurada: `programacion-iv-maximo-unrrein.vercel.app`) y subí el cambio.
4. **Frontend:** *Add New Project* → este repo → Root Directory `frontend` (preset Angular). No necesita variables.
5. En el backend agregá `CORS_ORIGIN` con la URL del frontend y hacé *Redeploy*.

Notas:
- En producción el frontend usa `environment.prod.ts` (API en `/api`, mismo dominio).
- Vercel limita cada request a 4,5 MB: las imágenes se achican en el navegador antes de subirse (`core/image.ts`).
- En producción el backend no arranca si `JWT_SECRET` tiene menos de 32 caracteres.

## Variables de entorno (`backend/.env`)

| Variable | Ejemplo | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto del backend |
| `CORS_ORIGIN` | `http://localhost:4200` | Orígenes permitidos (en desarrollo se acepta cualquier puerto de localhost) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/maxsend` | Conexión a MongoDB |
| `JWT_SECRET` | *(aleatorio)* | Firma de los tokens. **Nunca subirla al repo** |
| `JWT_EXPIRES_IN` | `15m` | Vencimiento del token |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | | Cuenta administradora del seed |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | | Cuenta de usuario del seed |

`backend/.env` está en `.gitignore`; sólo se sube `backend/.env.example`.
La URL de la API del frontend está en `frontend/src/environments/environment.ts`.

## Funcionalidades

- Registro completo con foto y login por correo o usuario, con validaciones y mensajes.
- Pantalla de carga que valida el token · modal a los 10 min para extender la sesión · ante un 401 vuelve al login.
- Publicaciones de texto o con hasta 4 imágenes (carrusel) · me gusta · comentarios editables y paginados,
  con respuestas en hilos de un nivel y me gusta · baja lógica · guardar · compartir con otro usuario.
- Mensajes directos entre usuarios (lo compartido también aparece en la conversación) con aviso de no leídos.
- Reportar publicaciones o comentarios; cola de moderación para administradores (dar de baja o descartar).
- Scroll infinito con orden por fecha, me gusta, guardados o compartidos · página de publicación `/p/:id`.
- Perfiles con todos los datos, últimas publicaciones, edición, foto y visitas recibidas.
- Búsqueda de personas y publicaciones por texto · Tendencias, Guardados y Compartidos conmigo.
- Dashboard de administración: usuarios (alta con perfil, habilitar/deshabilitar), moderación y 6 gráficos con
  período elegible, exportables a CSV (cada gráfico o todos juntos).
- PWA · 3 pipes propios (`media`, `ago`, `age`) · 3 directivas propias (`msInfiniteScroll`, `msAutosize`, `msAutofocus`).
- Tema oscuro y claro, responsive.

## API (prefijo `/api`, token en `Authorization: Bearer <token>`)

| Ruta | Descripción |
| --- | --- |
| `POST /auth/register` · `POST /auth/login` · `POST /auth/autorizar` · `POST /auth/refrescar` | Autenticación |
| `GET /posts?sort=&offset=&limit=&author=&tag=&q=` · `POST /posts` (multipart, `images` hasta 4) · `GET/DELETE /posts/:id` | Publicaciones |
| `POST/DELETE /posts/:id/like` | Me gusta |
| `POST /posts/:id/save` · `POST /posts/:id/unsave` · `GET /posts/saved` | Guardados |
| `POST /posts/:id/share` `{ to }` · `GET /posts/shared` | Compartidos |
| `GET/POST /posts/:id/comments` (`parentId` para responder) · `GET /comments/:id/replies` · `PUT/DELETE /comments/:id` · `POST/DELETE /comments/:id/like` | Comentarios |
| `GET /messages` · `GET /messages/unread` · `GET/POST /messages/:username` | Mensajes directos |
| `POST /reports` · Admin: `GET /reports?status=` · `GET /reports/pending-count` · `POST /reports/:targetId/resolve` | Moderación |
| `GET /trends/posts` · `GET /trends/tags` | Tendencias |
| `GET /users/:username` · `GET /users/search` · `PATCH /users/me` · `POST/DELETE /users/me/avatar` | Perfiles |
| `GET /media/:id` | Imágenes |
| Admin: `GET/POST /users` · `DELETE /users/:id` · `POST /users/:id/enable` · `PATCH /users/:id/role` | Usuarios |
| Admin: `GET /stats/summary`, `posts-by-user`, `comments-by-day`, `comments-by-post`, `likes-by-day`, `logins-by-user`, `visits-by-profile` | Estadísticas (`?from=&to=`) |

## PWA

El service worker sólo funciona en el build de producción:

```bash
cd frontend && npx ng build && npx http-server dist/frontend/browser -p 8080
```

## Problemas comunes

- **El backend no arranca (`JWT_SECRET`)** → falta `backend/.env`.
- **No conecta a MongoDB** → con Atlas, revisá `MONGODB_URI` y que tu IP esté en *Network Access*; con Docker, abrí Docker Desktop y usá `npm run dev:local`.
- **Puerto ocupado** → cerrá otra instancia de `npm run dev` / `ng serve`.
- **No entra la cuenta de prueba** → la contraseña debe tener 8+ caracteres, mayúscula y número; cambiala en `.env` y corré `npm run seed`.
