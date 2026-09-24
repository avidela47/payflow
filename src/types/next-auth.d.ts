import { DefaultSession } from "next-auth";
import type { RestrictableModule } from "@/models/User";

// Extiende los tipos de NextAuth para que `session.user.role`,
// `session.user.id` y `session.user.restrictedModules` existan sin castear
// "a mano" en cada archivo.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "OWNER" | "ACCOUNTANT";
      restrictedModules: RestrictableModule[];
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: "OWNER" | "ACCOUNTANT";
    restrictedModules: RestrictableModule[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "OWNER" | "ACCOUNTANT";
    restrictedModules: RestrictableModule[];
  }
}