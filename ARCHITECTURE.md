# PayFlow — Arquitectura

Sistema interno de ITELSA para reemplazar `libro_sueldos_y_gastos.xlsx`: sueldos, costos fijos/impuestos, cartera de cheques, horas de personal por hora, y un módulo aparte de credenciales (vault).

## 1. Decisión de stack

| Capa | Elección | Por qué |
|---|---|---|
| Framework | Next.js 14 (App Router) + TypeScript | Un solo proyecto para UI y API (server actions / route handlers). |
| Base de datos | **MongoDB Atlas** + Mongoose | Cambio de plan respecto a la primera versión de este documento (que proponía Postgres). La razón para Postgres seguía siendo válida en abstracto — estos datos son relacionales — pero en la práctica lo que importa es con qué herramienta se avanza rápido y sin fricción, y acá eso es Mongo Atlas. Costo real de este cambio, para que quede escrito una sola vez: Mongo no impone las relaciones ni la unicidad por vos — el "un sueldo por empleado y mes" que en Postgres era un constraint de la base, acá se hace a mano con `findOneAndUpdate(..., {upsert: true})` en el código (ver `src/app/(dashboard)/sueldos/actions.ts`). Mientras cada acción que escribe datos respete eso, no hay problema real para un sistema de 2 usuarios. |
| ODM | Mongoose | Esquemas tipados en `src/models/`, validación básica, índices únicos donde hacen falta. |
| Auth | Auth.js (NextAuth) con Credentials Provider | Login con email/contraseña, sesiones JWT, roles en el `User`. |
| UI | Tailwind CSS + shadcn/ui (Radix) | Paleta clara, componentes accesibles (cards, tablas, dialogs), fácil de tematizar cuando llegue el logo/paleta de marca. |
| Notificaciones | `sonner` | Toasts modernos, poco código. |
| Deploy | Vercel (igual que tus otras apps) | Sin servidor propio que mantener. La base sigue en MongoDB Atlas, no en Vercel — son dos servicios independientes conectados por `MONGODB_URI`. |
| Backups | Backups automáticos de Atlas (según el tier del cluster) — revisar que estén activados, no asumirlo | Es dinero y sueldos reales; sin backup esto no es "sólido", es una promesa. |

## 2. Roles

- **OWNER** (Ariel): acceso técnico total — usuarios, configuración, migraciones de datos, y es quien administra qué entradas del vault existen.
- **ACCOUNTANT** (la contadora): acceso funcional completo a sueldos, costos fijos, cheques y horas (alta, edición, reportes). **No tiene acceso al vault por default** — se le puede otorgar por entrada específica si algún día lo necesita. Esto es una decisión de diseño, no una limitación técnica: separar "quién opera los números" de "quién tiene las contraseñas de los bancos" reduce el daño de una sesión comprometida.

Ambos roles quedan en un enum `Role` en el modelo `User`; agregar un tercer rol (ej. un empleado viendo su propio recibo) es un cambio aditivo, no una reescritura.

## 3. Módulos y orden de construcción recomendado

Aunque el alcance acordado es el Excel completo, construirlo en un solo commit sería un riesgo. Orden sugerido (cada uno es usable de forma independiente):

1. **Auth + Dashboard shell** — login, layout, roles. (incluido en este scaffold)
2. **Sueldos** — empleados + liquidaciones mensuales. (incluido en este scaffold como módulo de referencia completo)
3. **Costos Fijos** — categorías de impuestos/gastos + montos por período.
4. **Cartera de Cheques** — alta, estado, vencimientos, alertas de cheques por vencer.
5. **Horas** — registro de horas de personal por hora + cálculo automático.
6. **Vault** — el módulo más sensible, se construye último y aislado (ver sección 4).

Los módulos 3-6 quedan como carpetas stub en este scaffold con el modelo de datos ya definido en `src/models/`, listos para implementar siguiendo el mismo patrón que Sueldos.

## 4. Vault de credenciales — diseño de seguridad

No es "otra tabla en Mongo". Es un módulo aparte con:

- **Cifrado a nivel de campo**: cada valor de contraseña se cifra con AES-256-GCM antes de tocar la base. La clave maestra (`VAULT_MASTER_KEY`) vive **solo** en la variable de entorno del servidor, nunca en el repo ni en la base de datos. Ver `src/lib/crypto.ts`.
- **Nada de texto plano en tránsito de vuelta al cliente por default**: la lista de servicios muestra usuario y metadata; el valor de la contraseña sólo se descifra y se muestra al pedirlo explícitamente ("revelar"), y esa acción queda registrada.
- **Auditoría**: tabla `VaultAccessLog` — quién vio o modificó qué entrada y cuándo. Sin esto, un vault es sólo una promesa de seguridad.
- **Acceso restringido**: por default solo OWNER; ACCOUNTANT se agrega entrada por entrada vía `VaultGrant`.

Esto agrega trabajo real (no es un CRUD más) — por eso va al final, cuando el resto del sistema ya esté probado.

## 5. Modelo de datos

Ver `src/models/` — es el modelo completo para las 5 hojas del Excel, incluso para los módulos que todavía no tienen UI. Resumen:

- `Employee` — asalariados, monotributistas y personal por hora (unificados con un `type`).
- `PayrollEntry` — un sueldo de un empleado en un período (mes/año), quién lo paga realmente (la empresa vs. Rubén, como aparece en tus notas), si está pagado.
- `FixedCostCategory` / `FixedCostEntry` — impuestos y costos fijos por período, con forma de pago y vencimiento.
- `Check` — cartera de cheques (electrónicos y físicos), con estado y ubicación actual.
- `HourLog` — horas trabajadas por período para personal por hora, con el valor hora vigente.
- `VaultEntry` / `VaultAccessLog` / `VaultGrant` — el módulo de credenciales.
- `User` — login y rol.

## 6. Qué falta decidir (no lo asumí)

- Si necesitás exportar reportes a PDF/Excel para presentar a ARCA/terceros (lo dejo como siguiente paso natural sobre Costos Fijos y Sueldos).
- Paleta de marca definitiva y logo — el scaffold usa una paleta neutra clara lista para reemplazar en `tailwind.config.ts` y `globals.css`.
- Plan de Vercel: Hobby (gratis) restringe a uso no comercial. Esto es nómina real de la empresa — en algún momento conviene evaluar Pro. Decisión tuya, no bloquea nada hoy.
