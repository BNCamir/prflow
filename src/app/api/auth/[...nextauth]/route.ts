import NextAuth from "next-auth";
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const options: AuthOptions & { trustHost?: boolean } = {
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const expectedUser = process.env.AUTH_USERNAME ?? "admin";
        const expectedPassword = process.env.AUTH_PASSWORD ?? "admin";
        if (
          credentials?.username === expectedUser &&
          credentials?.password === expectedPassword
        ) {
          return { id: "1", name: credentials.username, email: `${credentials.username}@local` };
        }
        return null;
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
};

const handler = NextAuth(options);

export { handler as GET, handler as POST };
