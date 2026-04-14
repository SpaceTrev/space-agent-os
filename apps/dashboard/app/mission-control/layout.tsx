// apps/dashboard/app/mission-control/layout.tsx
import Nav from '../../components/nav';

export default function MissionControlLayout({
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
