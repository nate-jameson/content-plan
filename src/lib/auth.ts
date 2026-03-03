import NextAuth from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({
  region: process.env.SES_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.SES_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SES_SECRET_ACCESS_KEY!,
  },
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: { host: 'localhost', port: 587, auth: { user: '', pass: '' } }, // Dummy - we use custom sendVerificationRequest with SES
      from: process.env.EMAIL_FROM || 'no-reply@jmsn.com',
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const command = new SendEmailCommand({
          Source: process.env.EMAIL_FROM || 'no-reply@jmsn.com',
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: 'Sign in to Content Review Dashboard' },
            Body: {
              Html: {
                Data: `
                  <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <h1 style="color: #0d9488; font-size: 24px; margin: 0;">ContentReview</h1>
                    </div>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6;">Click the button below to sign in to your Content Review Dashboard:</p>
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${url}" style="display: inline-block; padding: 14px 32px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Sign In</a>
                    </div>
                    <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">If you didn't request this email, you can safely ignore it. This link expires in 24 hours.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                    <p style="color: #cbd5e1; font-size: 12px;">Jameson Management Content Review</p>
                  </div>
                `,
              },
              Text: {
                Data: `Sign in to Content Review Dashboard:\n\n${url}\n\nIf you didn't request this, ignore this email.`,
              },
            },
          },
        });
        await sesClient.send(command);
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
    verifyRequest: '/login?verify=true',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const allowed = await prisma.allowedUser.findUnique({
        where: { email: user.email.toLowerCase() },
      });
      return !!allowed;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  session: {
    strategy: 'database',
  },
});
