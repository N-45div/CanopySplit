import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useReadContract } from 'wagmi';
import StrategyABI from '@/abis/YieldDonatingTokenizedStrategy.json';
import SplitterABI from '@/abis/TriSplitDonationSplitter.json';
import { ADDRS } from '@/config/contracts';
import { formatUnits } from 'viem';
import ERC20ABI from '@/abis/ERC20.json';
import useCountUp from '@/lib/useCountUp';

export default function Landing() {
  const strategyAddr = ADDRS.sepolia.strategy as `0x${string}`;
  const splitterAddr = ADDRS.sepolia.splitter as `0x${string}`;

  const { data: totalAssets } = useReadContract({
    address: strategyAddr,
    abi: StrategyABI as any,
    functionName: 'totalAssets',
    args: [],
  });
  const { data: pps } = useReadContract({
    address: strategyAddr,
    abi: StrategyABI as any,
    functionName: 'pricePerShare',
    args: [],
  });
  const { data: pendingShares } = useReadContract({
    address: splitterAddr,
    abi: SplitterABI as any,
    functionName: 'pendingShares',
    args: [],
  });
  const { data: currentEpoch } = useReadContract({
    address: splitterAddr,
    abi: SplitterABI as any,
    functionName: 'currentEpoch',
    args: [],
  });

  // Asset metadata
  const { data: assetAddress } = useReadContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'asset', args: [] });
  const { data: assetDecimals } = useReadContract({ address: assetAddress as any, abi: ERC20ABI as any, functionName: 'decimals', args: [] });
  const { data: assetSymbol } = useReadContract({ address: assetAddress as any, abi: ERC20ABI as any, functionName: 'symbol', args: [] });
  const dec = typeof assetDecimals === 'number' ? assetDecimals : 18;
  const symbol = (assetSymbol as string) || 'ASSET';

  const estPendingNum = (() => {
    if (!pendingShares || !pps) return undefined;
    const pv = (pendingShares as bigint) * (pps as bigint) / 10n**18n;
    return Number(formatUnits(pv, dec));
  })();
  const totalAssetsNum = totalAssets ? Number(formatUnits(totalAssets as bigint, dec)) : undefined;
  const caPending = useCountUp(estPendingNum ?? 0);
  const caTotal = useCountUp(totalAssetsNum ?? 0);

  return (
    <div className="min-h-[calc(100vh-56px-88px)] bg-white">
      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center bg-gradient-to-b from-slate-50 to-white rounded-b-3xl">
        <div className="mx-auto max-w-3xl">
          <span className="rounded-full border px-3 py-1 text-xs text-slate-600">Sepolia • Public Goods</span>
          <h1 className="mt-6 text-5xl font-extrabold tracking-tight md:text-6xl">Redirect your yield to public goods</h1>
          <p className="mt-4 text-slate-600 md:text-lg">Keep your principal. Let {symbol} profits fund impact through transparent, on‑chain splits.</p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/app#strategy"><Button size="lg">Deposit to grow shade</Button></Link>
            <Link to="/app#splitter"><Button size="lg" variant="outline">View Splitter</Button></Link>
          </div>
        </div>
      </section>

      <Separator />

      {/* Metrics */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6 text-center">
            <div className="text-sm text-slate-500">Principal deposited</div>
            <div className="mt-1 text-3xl font-semibold">
              {totalAssetsNum === undefined ? (
                <Skeleton className="mx-auto h-8 w-32" />
              ) : (
                caTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })
              )}
            </div>
            <div className="text-xs text-slate-500">{symbol}</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-sm text-slate-500">Pending donation (est.)</div>
            <div className="mt-1 text-3xl font-semibold">
              {estPendingNum === undefined ? (
                <Skeleton className="mx-auto h-8 w-32" />
              ) : (
                caPending.toLocaleString(undefined, { maximumFractionDigits: 2 })
              )}
            </div>
            <div className="text-xs text-slate-500">{symbol}</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-sm text-slate-500">Trees funded (est.)</div>
            <div className="mt-1 text-3xl font-semibold">{estPendingNum === undefined ? '...' : Math.floor((estPendingNum || 0) / 1.5)}</div>
            <div className="text-xs text-slate-500">$1.50 per tree</div>
          </Card>
        </div>
      </section>
    </div>
  );
}
