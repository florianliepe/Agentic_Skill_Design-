import type { Metadata } from "next";
import "./studio.css";

export const metadata: Metadata = {
  title: "Skill Design Studio | Eraneos",
  description: "From changing work to clear capabilities. Roles, emerging skills and team development.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
