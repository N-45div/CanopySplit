import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ADDRS } from '@/config/contracts';
import { useReadContract } from 'wagmi';
import SplitterABI from '@/abis/TriSplitDonationSplitter.json';
import StrategyABI from '@/abis/YieldDonatingTokenizedStrategy.json';
import { formatUnits } from 'viem';
import ERC20ABI from '@/abis/ERC20.json';

export default function ImpactPage() {
  const splitterAddr = ADDRS.sepolia.splitter as `0x${string}`;
  const strategyAddr = ADDRS.sepolia.strategy as `0x${string}`;

  const { data: pps } = useReadContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'pricePerShare', args: [] });
  const { data: pendingShares } = useReadContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'pendingShares', args: [] });
  const { data: currentEpoch } = useReadContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'currentEpoch', args: [] });
  const epoch = (currentEpoch ?? 0n) as bigint;
  const { data: epochWeights } = useReadContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'getEpochWeights', args: [epoch] });

  // Asset metadata
  const { data: assetAddress } = useReadContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'asset', args: [] });
  const { data: assetDecimals } = useReadContract({ address: assetAddress as any, abi: ERC20ABI as any, functionName: 'decimals', args: [] });
  const { data: assetSymbol } = useReadContract({ address: assetAddress as any, abi: ERC20ABI as any, functionName: 'symbol', args: [] });
  const dec = typeof assetDecimals === 'number' ? assetDecimals : 18;
  const symbol = (assetSymbol as string) || 'ASSET';

  const estPending = (() => {
    if (!pendingShares || !pps) return '0';
    const pv = (pendingShares as bigint) * (pps as bigint) / 10n**18n;
    return formatUnits(pv, dec);
  })();

  return (
    <div className="container mx-auto min-h-[calc(100vh-56px-88px)] space-y-10 px-4 py-10">
      <section>
        <h1 className="text-4xl font-bold">Impact</h1>
        <p className="text-slate-600">Transparent, on-chain donation routing. See what’s queued to be donated right now.</p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="p-8 text-center">
          <div className="text-sm text-slate-500">Ready to Donate (est.)</div>
          <div className="mt-1 text-3xl font-semibold">{estPending}</div>
          <div className="text-xs text-slate-500">{symbol}</div>
        </Card>
        <Card className="p-8 text-center">
          <div className="text-sm text-slate-500">Current Epoch</div>
          <div className="mt-1 text-3xl font-semibold">{currentEpoch?.toString() ?? '...'}</div>
          <div className="text-xs text-slate-500">Weights determine split</div>
        </Card>
        <Card className="p-8 text-center">
          <div className="text-sm text-slate-500">Donation Token</div>
          <div className="mt-1 text-3xl font-semibold">{symbol}</div>
          <div className="text-xs text-slate-500">Sepolia</div>
        </Card>
      </section>

      <Separator />

      <section className="space-y-6">
        <Card className="space-y-4 p-8">
          <h3 className="text-2xl font-semibold">Recipients this Epoch</h3>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            {(() => {
              const tuple = epochWeights as any;
              const recs = tuple?.[0] as string[] | undefined;
              const bps = tuple?.[1] as number[] | undefined;
              return [0,1,2].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="text-muted-foreground">Recipient {i+1}</div>
                  <div className="font-mono break-all">{recs?.[i] ?? '...'}</div>
                  <div className="text-xs">{bps?.[i] ?? 0} bps</div>
                </div>
              ));
            })()}
          </div>
          <p className="text-xs text-slate-500">Weights are basis points per epoch (sum 10,000 bps).</p>
        </Card>
      </section>
    </div>
  );
}
