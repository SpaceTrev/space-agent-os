// apps/dashboard/app/marketplace/layout.tsx

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100">
      {children}
    </div>
  );
}
