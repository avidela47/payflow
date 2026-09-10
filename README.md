# PayFlow

Ver `ARCHITECTURE.md` primero — ahí está el por qué de cada decisión (incluido el cambio de Postgres a MongoDB Atlas) y el orden de construcción de los módulos.

## Desarrollo local (VS Code)

Requisitos: Node 20+, una cuenta de MongoDB Atlas (o cualquier Mongo accesible).

```bash
npm install
cp .env.example .env
# completá MONGODB_URI (tu connection string de Atlas), NEXTAUTH_SECRET y VAULT_MASTER_KEY en .env
# (openssl rand -base64 32 genera valores válidos para los dos secretos)

npm run seed
npm run dev
```

Abrí `http://localhost:3000`. Usuarios de ejemplo creados por el seed (cambiá las contraseñas):

- `ariel@itelsasas.com` — rol OWNER
- `contadora@itelsasas.com` — rol ACCOUNTANT

## Estructura

```
src/app/(dashboard)/     módulos protegidos por login (sueldos, costos-fijos, cheques, horas, vault)
src/app/login/           pantalla de login
src/components/ui/       componentes base (botón, card, tabla...)
src/lib/                 conexión a Mongo, auth, cifrado del vault, utilidades
src/models/              esquemas Mongoose (equivalente a las 5 hojas del Excel)
src/scripts/seed.ts      datos de ejemplo para arrancar
```

El módulo **Sueldos** está completo (listado + alta) y sirve como patrón para implementar Costos Fijos, Cheques y Horas de la misma forma: `page.tsx` (server component que lee con Mongoose) + `actions.ts` (server actions con `zod`) + un form cliente que llama la action y muestra un toast.

## Deploy

Igual que tus otras apps:

```bash
vercel
```

o conectando el repo desde el dashboard de Vercel. Variables de entorno a configurar ahí (Project Settings → Environment Variables): `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (la URL real del deploy), `VAULT_MASTER_KEY`. Tienen que ser valores de producción, no los mismos que usás en tu compu.

## Seguridad — antes de poner esto en producción

- Cambiá las contraseñas del seed.
- `NEXTAUTH_SECRET` y `VAULT_MASTER_KEY` tienen que ser distintos entre desarrollo y producción, y no deben estar en ningún commit.
- Revisá que tu cluster de Atlas tenga backups automáticos activados — no viene garantizado en todos los tiers.
- Si vas a subir este repo a GitHub, `.env` ya está en `.gitignore` — revisá que nunca se haya commiteado un `.env` real antes de hacer el repo público.
