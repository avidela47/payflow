import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, type RestrictableModule } from "@/models/User";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await User.findOne({ email: credentials.email });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          restrictedModules: user.restrictedModules ?? [],
          employeeId: user.employeeId?.toString(),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.restrictedModules = user.restrictedModules;
        token.employeeId = user.employeeId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.id = token.id;
      session.user.restrictedModules = token.restrictedModules ?? [];
      session.user.employeeId = token.employeeId;
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

// Login (sesión inexistente) → /login. Módulo restringido para este
// usuario puntual (ver User.restrictedModules) → al Dashboard. Usarlo al
// principio de cada página protegida en (dashboard) y en /imprimir/reportes/*.
// Nota: esto protege la página, no las server actions del módulo — mismo
// criterio que ya usaba /vault antes de este cambio.
export async function requireModuleAccess(moduleKey: RestrictableModule) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.restrictedModules?.includes(moduleKey)) {
    redirect("/");
  }

  return session;
}

// Mismo mecanismo que requireModuleAccess, pensado para un reporte puntual
// dentro de /reportes/*: ya se pasó el check de acceso a "reportes" en sí
// (quien llama hace requireModuleAccess("reportes") antes), pero ese
// reporte puede exponer datos de uno o varios módulos puntuales que este
// usuario sí tiene restringidos (ver REPORT_CARDS en reportes/page.tsx,
// 2026-11-25, pedido de Ariel: "reportes de acuerdo a sus módulos"). Si
// falta acceso a CUALQUIERA de los módulos listados, vuelve al listado de
// Reportes en vez de al Dashboard — ya pasó el gate de "reportes", solo le
// falta éste en particular.
export async function requireReportModules(
  session: Awaited<ReturnType<typeof getSession>>,
  moduleKeys: RestrictableModule[]
) {
  const restricted = session?.user?.restrictedModules ?? [];
  if (moduleKeys.some((k) => restricted.includes(k))) {
    redirect("/reportes");
  }
}