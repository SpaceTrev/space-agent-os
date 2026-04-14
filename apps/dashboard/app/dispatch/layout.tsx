// apps/dashboard/app/dispatch/layout.tsx
import Nav from '../../components/nav';

export default function DispatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="pt-14">{children}</main>
    </>
  );
}
