export default function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 md:flex-row">
        <div>© {new Date().getFullYear()} TriSplit YDS • Sepolia Testnet</div>
        <div className="flex items-center gap-4">
          <a className="hover:text-slate-900" href="https://docs.v2.octant.build/" target="_blank" rel="noreferrer">Docs</a>
          <a className="hover:text-slate-900" href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
