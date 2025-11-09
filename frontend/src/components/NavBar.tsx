import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function NavBar() {
  const { pathname, hash } = useLocation();

  const linkBase = 'text-sm font-medium text-slate-600 hover:text-slate-900 transition';
  const isActive = (targetHash: string) => pathname === '/app' && hash === targetHash;
  const active = 'text-slate-900 underline underline-offset-8';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">CanopySplit</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Octant v2</span>
        </Link>
        <nav className="hidden gap-6 md:flex">
          <Link to="/app#strategy" className={`${linkBase} ${isActive('#strategy') ? active : ''}`}>Strategy</Link>
          <Link to="/app#splitter" className={`${linkBase} ${isActive('#splitter') ? active : ''}`}>Splitter</Link>
          <Link to="/app#impact" className={`${linkBase} ${isActive('#impact') ? active : ''}`}>Impact</Link>
          <Link to="/app#faq" className={`${linkBase} ${isActive('#faq') ? active : ''}`}>FAQ</Link>
          <Link to="/hooks" className={`${linkBase}`}>Hooks</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
        </div>
      </div>
    </header>
  );
}
