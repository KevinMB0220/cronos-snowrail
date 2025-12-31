import type { Metadata } from "next";
import { Providers } from "../components/providers";
import { Navbar } from "../components/navbar";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Cronos x402 Agentic Treasury",
  description: "Autonomous Agentic Treasury on Cronos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950 text-white font-sans overflow-x-hidden">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent opacity-100"></div>
          <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-cyan-500/3 rounded-full blur-3xl" style={{animation: 'floatSmooth1 22s cubic-bezier(0.4, 0, 0.2, 1) infinite'}}></div>
          <div className="absolute bottom-1/4 left-1/4 w-[550px] h-[550px] bg-blue-500/4 rounded-full blur-3xl" style={{animation: 'floatSmooth2 28s cubic-bezier(0.4, 0, 0.2, 1) infinite 7s'}}></div>
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-indigo-500/2 rounded-full blur-3xl" style={{animation: 'floatSmooth3 35s cubic-bezier(0.4, 0, 0.2, 1) infinite 14s'}}></div>
        </div>
        <style>{`
          @keyframes floatSmooth1 {
            0%, 100% {
              transform: translate(0px, 0px) scale(1);
              opacity: 0.25;
            }
            33% {
              transform: translate(40px, -30px) scale(1.08);
              opacity: 0.30;
            }
            66% {
              transform: translate(-30px, 40px) scale(0.95);
              opacity: 0.28;
            }
          }
          @keyframes floatSmooth2 {
            0%, 100% {
              transform: translate(0px, 0px) scale(1) rotate(0deg);
              opacity: 0.28;
            }
            40% {
              transform: translate(-50px, 35px) scale(1.05) rotate(2deg);
              opacity: 0.32;
            }
            75% {
              transform: translate(45px, -40px) scale(0.98) rotate(-2deg);
              opacity: 0.30;
            }
          }
          @keyframes floatSmooth3 {
            0%, 100% {
              transform: translate(0px, 0px) scale(1);
              opacity: 0.20;
            }
            50% {
              transform: translate(30px, 30px) scale(1.12);
              opacity: 0.24;
            }
          }
        `}</style>
        <div className="relative z-10">
          <Providers>
            <Navbar />
            <main className="pt-20 w-full">
              {children}
            </main>
          </Providers>
        </div>
      </body>
    </html>
  );
}

