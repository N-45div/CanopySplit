import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ADDRS } from '@/config/contracts';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import SplitterABI from '@/abis/TriSplitDonationSplitter.json';
import StrategyABI from '@/abis/YieldDonatingTokenizedStrategy.json';
import { formatUnits } from 'viem';
import { toast } from 'sonner';
import ERC20ABI from '@/abis/ERC20.json';

export default function SplitterPage() {
  const splitterAddr = ADDRS.sepolia.splitter as `0x${string}`;
  const strategyAddr = ADDRS.sepolia.strategy as `0x${string}`;
  const { isConnected } = useAccount();

  const { data: pendingShares, refetch, isFetching } = useReadContract({
    address: splitterAddr,
    abi: SplitterABI as any,
    functionName: 'pendingShares',
    args: [],
  });
  const { data: pps } = useReadContract({
    address: strategyAddr,
    abi: StrategyABI as any,
    functionName: 'pricePerShare',
    args: [],
  });
  const { data: currentEpoch } = useReadContract({
    address: splitterAddr,
    abi: SplitterABI as any,
    functionName: 'currentEpoch',
    args: [],
  });
  const epoch = (currentEpoch ?? 0n) as bigint;
  const { data: epochWeights } = useReadContract({
    address: splitterAddr,
    abi: SplitterABI as any,
    functionName: 'getEpochWeights',
    args: [epoch],
  });

  const { writeContract, isPending } = useWriteContract();

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
        <h1 className="text-4xl font-bold">TriSplit Splitter</h1>
        <p className="text-slate-600">Redeem donated shares and route {symbol} to 3 recipients by epoch weights.</p>
      </section>

      <section className="space-y-6">
        <Card className="p-8">
          <div className="grid gap-6 md:grid-cols-3 text-center">
            <div>
              <div className="text-sm text-slate-500">Pending Shares</div>
              <div className="mt-1 text-3xl font-semibold">{isFetching ? '...' : pendingShares ? formatUnits(pendingShares as bigint, 18) : '0'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Price Per Share</div>
              <div className="mt-1 text-3xl font-semibold">{pps ? formatUnits(pps as bigint, 18) : '1.0'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Pending Donation (est.)</div>
              <div className="mt-1 text-3xl font-semibold">{estPending}</div>
            </div>
          </div>
          <div className="mt-6">
            <Button
              className="w-full"
              disabled={!isConnected || isPending || (pendingShares ? ((pendingShares as bigint) === 0n) : true)}
              onClick={async () => {
                try {
                  const tx = await writeContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'distributeAll', args: [] });
                  toast.success(`Distributed. Tx: ${tx}`);
                  setTimeout(() => refetch(), 2500);
                } catch (e: any) {
                  toast.error(e?.shortMessage || e?.message || 'Distribution failed');
                }
              }}
            >
              {isPending ? 'Distributing...' : 'Distribute'}
            </Button>
          </div>
        </Card>
      </section>

      <Separator />

      <section className="space-y-6">
        <Card className="space-y-4 p-8">
          <h3 className="text-2xl font-semibold">Recipients & Weights</h3>
          <div className="text-sm text-slate-500">Epoch: {currentEpoch?.toString() ?? '...'}</div>
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
        </Card>
      </section>
    </div>
  );
}
