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
npm run dev     # levanta MongoDB + backend (:3000) + frontend (:4200)
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
| `npm run dev` | MongoDB + backend (watch) + frontend |
| `npm run seed` | Carga/actualiza los datos de prueba (no duplica) |
| `npm run db:up` / `npm run db:down` | Levanta / apaga MongoDB |

## Paso a paso (sin los comandos de la raíz)

```bash
docker compose up -d                                   # MongoDB
cd backend && npm install && npm run seed && npm run start:dev   # API en http://localhost:3000/api
cd frontend && npm install && npm start                # app en http://127.0.0.1:4200 (otra terminal)
```

Sin Docker: cambiá `MONGODB_URI` en `backend/.env` por la URL de tu MongoDB (por ej. Atlas).

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
- Publicaciones con título, mensaje e imagen · me gusta · comentarios editables y paginados · baja lógica ·
  guardar · compartir con otro usuario.
- Scroll infinito con orden por fecha, me gusta, guardados o compartidos · página de publicación `/p/:id`.
- Perfiles con todos los datos, últimas publicaciones, edición, foto y visitas recibidas.
- Tendencias, Guardados y Compartidos conmigo.
- Dashboard de administración: usuarios (alta con perfil, habilitar/deshabilitar) y 6 gráficos con período elegible.
- PWA · 3 pipes propios (`media`, `ago`, `age`) · 3 directivas propias (`msInfiniteScroll`, `msAutosize`, `msAutofocus`).
- Tema oscuro y claro, responsive.

## API (prefijo `/api`, token en `Authorization: Bearer <token>`)

| Ruta | Descripción |
| --- | --- |
| `POST /auth/register` · `POST /auth/login` · `POST /auth/autorizar` · `POST /auth/refrescar` | Autenticación |
| `GET /posts?sort=&offset=&limit=&author=&tag=` · `POST /posts` · `GET/DELETE /posts/:id` | Publicaciones |
| `POST/DELETE /posts/:id/like` | Me gusta |
| `POST /posts/:id/save` · `POST /posts/:id/unsave` · `GET /posts/saved` | Guardados |
| `POST /posts/:id/share` `{ to }` · `GET /posts/shared` | Compartidos |
| `GET/POST /posts/:id/comments` · `PUT/DELETE /comments/:id` | Comentarios |
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
- **No conecta a MongoDB** → abrí Docker Desktop y corré `npm run db:up`.
- **Puerto ocupado** → cerrá otra instancia de `npm run dev` / `ng serve`.
- **No entra la cuenta de prueba** → la contraseña debe tener 8+ caracteres, mayúscula y número; cambiala en `.env` y corré `npm run seed`.
