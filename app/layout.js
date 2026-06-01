import './globals.css';

export const metadata = {
  title: 'lightblue',
  description: 'A private conversation with Ru.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
