/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CH Group Chat",
  description: "Chat app UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
