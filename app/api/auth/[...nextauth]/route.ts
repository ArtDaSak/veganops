import NextAuth from "next-auth";
import { opcionesAuth } from "../../../../lib/auth";

const handler = NextAuth(opcionesAuth);
export { handler as GET, handler as POST };
