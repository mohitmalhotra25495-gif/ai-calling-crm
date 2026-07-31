import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AI Calling CRM",
  description:
    "Modern AI-powered calling CRM with smart analytics and lead management.",
};

// This script runs BEFORE the page paints - no theme flash!
const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem('crm-theme');
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // Default is dark mode
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
