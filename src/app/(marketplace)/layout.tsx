import MarketplaceShell from "./MarketplaceShell";

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketplaceShell>{children}</MarketplaceShell>;
}
