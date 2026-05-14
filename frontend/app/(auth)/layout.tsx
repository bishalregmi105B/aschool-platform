export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 py-8">
      <div className="w-full max-w-2xl px-4">{children}</div>
    </div>
  );
}
