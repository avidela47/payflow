import { DefaultSession } from "next-auth";

// Extiende los tipos de NextAuth para que `session.user.role` y
// `session.user.id` existan sin castear "a mano" en cada archivo.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "OWNER" | "ACCOUNTANT";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: "OWNER" | "ACCOUNTANT";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "OWNER" | "ACCOUNTANT";
  }
}
