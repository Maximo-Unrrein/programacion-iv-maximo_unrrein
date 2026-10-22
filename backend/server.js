// Entrada del backend en Vercel (ver vercel.json en la raíz).
// Carga la salida de `nest build` (dist/), donde los decoradores ya están compilados a JavaScript:
// así Vercel puede rastrear qué dependencias de node_modules incluir en la función.
// (Si se usa src/main.ts directamente, el rastreo falla con decoradores: vercel/vercel#17712).
require('./dist/main');
