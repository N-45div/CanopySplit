import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import StrategyABI from '@/abis/YieldDonatingTokenizedStrategy.json';
import SplitterABI from '@/abis/TriSplitDonationSplitter.json';
import ERC20ABI from '@/abis/ERC20.json';
import { ADDRS } from '@/config/contracts';
import { getRecipientMeta } from '@/config/recipients';
import { formatUnits, parseUnits, parseAbiItem } from 'viem';
import { toast } from 'sonner';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className || ''}`} />;
}

// Extra ABI for management-only demo helper on strategy
const StrategyExtrasABI = [
  {
    type: 'function',
    name: 'simulateProfit',
    inputs: [{ name: 'amount', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
];

export default function AppPage() {
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [profitAmt, setProfitAmt] = useState('');
  const [nb0, setNb0] = useState('');
  const [nb1, setNb1] = useState('');
  const [nb2, setNb2] = useState('');
  const [logsNonce, setLogsNonce] = useState(0);

  const strategyAddr = ADDRS.sepolia.strategy as `0x${string}`;
  const splitterAddr = ADDRS.sepolia.splitter as `0x${string}`;
  const usdcAddr = ADDRS.sepolia.usdc as `0x${string}`;

  const { address: account, isConnected } = useAccount();
  const { writeContract, isPending: sending } = useWriteContract();
  const client = usePublicClient();

  const copyToClipboard = (v: string) => {
    if (!v) return;
    navigator.clipboard?.writeText(v);
    toast.success('Copied');
  };

  const notifyTx = (label: string, tx: unknown) => {
    const hash = typeof tx === 'string' ? tx : (tx as any)?.hash;
    if (!hash) {
      toast.success(label);
      return;
    }
    const url = `https://sepolia.etherscan.io/tx/${hash}`;
    toast.success(
      <span className="text-sm">
        {label}.{' '}
        <a className="text-indigo-600 underline" href={url} target="_blank" rel="noreferrer">
          Etherscan
        </a>
      </span>
    );
  };

  // Reads
  const { data: totalAssets } = useReadContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'totalAssets', args: [] });
  const { data: pps } = useReadContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'pricePerShare', args: [] });
  const { data: pendingShares, refetch: refetchPending, isFetching: loadingPending } = useReadContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'pendingShares', args: [] });
  const { data: currentEpoch, refetch: refetchCurrentEpoch } = useReadContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'currentEpoch', args: [] });
  const epochArg: bigint = ((currentEpoch as unknown as bigint) ?? 0n);
  const { data: epochWeights, refetch: refetchEpochWeights } = useReadContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'getEpochWeights', args: [epochArg] });
  const { data: assetAddress } = useReadContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'asset', args: [] });
  const nextEpochArg: bigint = (epochArg + 1n);
  const { data: nextEpochWeights, refetch: refetchNextEpochWeights } = useReadContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'getEpochWeights', args: [nextEpochArg] });
  const { data: managementAddr } = useReadContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'management', args: [] });
  const { data: keeperAddr } = useReadContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'keeper', args: [] });
  const { data: ownerAddr } = useReadContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'owner', args: [] });

  const isMgmt = !!(account && managementAddr && account.toLowerCase() === (managementAddr as string).toLowerCase());
  const isKeeper = !!(account && keeperAddr && account.toLowerCase() === (keeperAddr as string).toLowerCase());
  const isMgmtOrKeeper = isMgmt || isKeeper;
  const isOwner = !!(account && ownerAddr && account.toLowerCase() === (ownerAddr as string).toLowerCase());

  const estPendingUSDC = (() => {
    if (!pendingShares || !pps) return '0';
    const pv = (pendingShares as bigint) * (pps as bigint) / 10n**18n;
    return formatUnits(pv, 6);
  })();

  // Logs-based lifetime receipts
  const [lifetimeUsd, setLifetimeUsd] = useState<number | null>(null);
  const [epochUsd, setEpochUsd] = useState<number | null>(null);
  const [recentTxs, setRecentTxs] = useState<string[]>([]);
  useEffect(() => {
    if (!client) return;
    (async () => {
      try {
        const event = parseAbiItem('event Distributed(uint256 epoch, uint256 sharesRedeemed, uint256 assetsDistributed)');
        const logs = await client.getLogs({ address: splitterAddr, event, fromBlock: 0n });
        let total = 0n;
        let epochTotal = 0n;
        const txs: string[] = [];
        for (const l of logs) {
          const assets = (l.args?.assetsDistributed as bigint) ?? 0n;
          total += assets;
          if ((l.args?.epoch as bigint) === epochArg) epochTotal += assets;
          // @ts-ignore
          if (l.transactionHash) txs.push(l.transactionHash as string);
        }
        setLifetimeUsd(Number(formatUnits(total, 6)));
        setEpochUsd(Number(formatUnits(epochTotal, 6)));
        setRecentTxs(txs.slice(-3).reverse());
      } catch {
        // ignore for demo
      }
    })();
  }, [client, splitterAddr, epochArg, logsNonce]);

  // Prefill next-epoch bps editors once weights load
  useEffect(() => {
    const bps = (nextEpochWeights as any)?.[1] as number[] | undefined;
    if (bps && (bps[0] || bps[1] || bps[2])) {
      setNb0(String(bps[0] || 0));
      setNb1(String(bps[1] || 0));
      setNb2(String(bps[2] || 0));
    } else {
      // default to current policy as fallback
      const cur = (epochWeights as any)?.[1] as number[] | undefined;
      if (cur) {
        setNb0(String(cur[0] || 0));
        setNb1(String(cur[1] || 0));
        setNb2(String(cur[2] || 0));
      }
    }
  }, [nextEpochWeights, epochWeights]);

  return (
    <div className="min-h-[calc(100vh-56px-88px)] bg-white">
      {/* Hero */}
      <section id="hero" className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight md:text-6xl">CanopySplit</h1>
        <p className="mt-3 text-slate-600 md:text-lg">Turn idle USDC into urban shade. Principal stays yours; yield funds planting, open MRV, and maintenance.</p>
      </section>

      {/* How it works */}
      <section id="how" className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-3xl space-y-3 p-8 text-center">
          <h3 className="text-2xl font-semibold">How it works</h3>
          <p className="text-slate-600">Deposits earn yield. Profits are minted as shares to the TriSplit splitter, redeemed to USDC, and routed to three recipients by epoch weights.</p>
        </Card>
      </section>

      {/* Metrics */}
      <section id="metrics" className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6 text-center">
            <div className="text-sm text-slate-500">Total Assets</div>
            <div className="mt-1 text-3xl font-semibold">
              {typeof totalAssets === 'bigint' ? formatUnits(totalAssets as bigint, 6) : <Skeleton className="h-7 mx-auto w-24" />}
            </div>
            <div className="text-xs text-slate-500">USDC</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-sm text-slate-500">Pending Donation (est.)</div>
            <div className="mt-1 text-3xl font-semibold">{(pendingShares && pps) ? estPendingUSDC : <Skeleton className="h-7 mx-auto w-28" />}</div>
            <div className="text-xs text-slate-500">USDC</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-sm text-slate-500">Current Epoch</div>
            <div className="mt-1 text-3xl font-semibold">{typeof currentEpoch === 'bigint' ? currentEpoch.toString() : <Skeleton className="h-7 mx-auto w-16" />}</div>
            <div className="text-xs text-slate-500">TriSplit weights apply</div>
          </Card>
        </div>
      </section>

      <Separator />

      {/* Strategy Actions */}
      <section id="strategy" className="container mx-auto space-y-6 px-4 py-10">
        <Card className="space-y-4 p-8">
          <h3 className="text-2xl font-semibold">Strategy Actions</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="text-muted-foreground">Deposit USDC</div>
              <input className="w-full rounded border border-gray-300 px-3 py-2" placeholder="Amount (USDC)" value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} />
              <Button
                className="w-full transition-transform duration-150 active:scale-[.98]"
                disabled={!isConnected || sending || !depositAmt}
                onClick={async () => {
                  try {
                    const amt = parseUnits(depositAmt as `${string}` as string, 6);
                    await writeContract({ address: usdcAddr, abi: ERC20ABI as any, functionName: 'approve', args: [strategyAddr, amt] });
                    const tx = await writeContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'deposit', args: [amt, account!] });
                    notifyTx('Deposited', tx);
                  } catch (e: any) {
                    toast.error(e?.shortMessage || e?.message || 'Deposit failed');
                  }
                }}
              >
                {sending ? 'Processing...' : 'Approve & Deposit'}
              </Button>
            </div>
            <div className="space-y-3">
              <div className="text-muted-foreground">Withdraw Assets</div>
              <input className="w-full rounded border border-gray-300 px-3 py-2" placeholder="Amount (USDC)" value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} />
              <Button
                className="w-full transition-transform duration-150 active:scale-[.98]"
                disabled={!isConnected || sending || !withdrawAmt}
                onClick={async () => {
                  try {
                    const amt = parseUnits(withdrawAmt as `${string}` as string, 6);
                    const tx = await writeContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'withdraw', args: [amt, account!, account!] });
                    notifyTx('Withdrawn', tx);
                  } catch (e: any) {
                    toast.error(e?.shortMessage || e?.message || 'Withdraw failed');
                  }
                }}
              >
                {sending ? 'Processing...' : 'Withdraw'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Maintenance (role-gated) */}
        <Card className="space-y-4 p-8">
          <h3 className="text-2xl font-semibold">Maintenance</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="text-muted-foreground">Report / Harvest</div>
              <Button
                className="w-full transition-transform duration-150 active:scale-[.98]"
                disabled={!isConnected || sending || !isMgmtOrKeeper}
                onClick={async () => {
                  try {
                    const tx = await writeContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'report', args: [] });
                    notifyTx('Reported', tx);
                    setTimeout(() => {
                      refetchPending();
                      refetchEpochWeights();
                      refetchNextEpochWeights();
                      setLogsNonce((n) => n + 1);
                    }, 2500);
                  } catch (e: any) {
                    toast.error(e?.shortMessage || e?.message || 'Report failed');
                  }
                }}
              >
                {sending ? 'Reporting...' : isMgmtOrKeeper ? 'Report / Harvest' : 'Report (keeper/management only)'}
              </Button>
            </div>
            <div className="space-y-3">
              <div className="text-muted-foreground">Simulate Profit (demo, management only)</div>
              <input className="w-full rounded border border-gray-300 px-3 py-2" placeholder="Amount (USDC)" value={profitAmt} onChange={(e) => setProfitAmt(e.target.value)} />
              <Button
                className="w-full transition-transform duration-150 active:scale-[.98]"
                disabled={!isConnected || sending || !profitAmt || !isMgmt}
                onClick={async () => {
                  try {
                    const amt = parseUnits(profitAmt as `${string}` as string, 6);
                    await writeContract({ address: usdcAddr, abi: ERC20ABI as any, functionName: 'approve', args: [strategyAddr, amt] });
                    const tx = await writeContract({ address: strategyAddr, abi: StrategyExtrasABI as any, functionName: 'simulateProfit', args: [amt] });
                    notifyTx('Simulated profit', tx);
                  } catch (e: any) {
                    toast.error(e?.shortMessage || e?.message || 'Simulate failed');
                  }
                }}
              >
                {sending ? 'Processing...' : isMgmt ? 'Approve & Simulate' : 'Management only'}
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Tip: Simulate profit, then click Report to mint donation shares to the splitter.</div>
        </Card>

        <Card className="space-y-4 p-8">
          <h3 className="text-2xl font-semibold">Strategy Status</h3>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <div className="text-muted-foreground">Strategy</div>
              <div className="font-mono break-all">
                <a className="text-indigo-600 hover:underline" href={`https://sepolia.etherscan.io/address/${strategyAddr}`} target="_blank" rel="noreferrer">
                  {strategyAddr.slice(0, 6)}…{strategyAddr.slice(-4)}
                </a>
                <button className="ml-2 text-xs text-indigo-600 hover:underline" onClick={() => copyToClipboard(strategyAddr)}>Copy</button>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Asset</div>
              <div className="font-mono break-all">
                {assetAddress ? (
                  <>
                    <a className="text-indigo-600 hover:underline" href={`https://sepolia.etherscan.io/address/${assetAddress as string}`} target="_blank" rel="noreferrer">
                      {(assetAddress as string).slice(0, 6)}…{(assetAddress as string).slice(-4)}
                    </a>
                    <button className="ml-2 text-xs text-indigo-600 hover:underline" onClick={() => copyToClipboard(assetAddress as string)}>Copy</button>
                  </>
                ) : '...'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Assets</div>
              <div className="font-mono">{totalAssets ? formatUnits(totalAssets as bigint, 6) : '0'}</div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3 text-sm mt-4">
            <div>
              <div className="text-muted-foreground">Management</div>
              <div className="font-mono break-all">
                {managementAddr ? (
                  <>
                    <a className="text-indigo-600 hover:underline" href={`https://sepolia.etherscan.io/address/${managementAddr as string}`} target="_blank" rel="noreferrer">
                      {(managementAddr as string).slice(0, 6)}…{(managementAddr as string).slice(-4)}
                    </a>
                    <button className="ml-2 text-xs text-indigo-600 hover:underline" onClick={() => copyToClipboard(managementAddr as string)}>Copy</button>
                  </>
                ) : '...'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Keeper</div>
              <div className="font-mono break-all">
                {keeperAddr ? (
                  <>
                    <a className="text-indigo-600 hover:underline" href={`https://sepolia.etherscan.io/address/${keeperAddr as string}`} target="_blank" rel="noreferrer">
                      {(keeperAddr as string).slice(0, 6)}…{(keeperAddr as string).slice(-4)}
                    </a>
                    <button className="ml-2 text-xs text-indigo-600 hover:underline" onClick={() => copyToClipboard(keeperAddr as string)}>Copy</button>
                  </>
                ) : '...'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Owner (Splitter)</div>
              <div className="font-mono break-all">
                {ownerAddr ? (
                  <>
                    <a className="text-indigo-600 hover:underline" href={`https://sepolia.etherscan.io/address/${ownerAddr as string}`} target="_blank" rel="noreferrer">
                      {(ownerAddr as string).slice(0, 6)}…{(ownerAddr as string).slice(-4)}
                    </a>
                    <button className="ml-2 text-xs text-indigo-600 hover:underline" onClick={() => copyToClipboard(ownerAddr as string)}>Copy</button>
                  </>
                ) : '...'}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <Separator />

      {/* Splitter */}
      <section id="splitter" className="container mx-auto space-y-6 px-4 py-10">
        <Card className="space-y-4 p-8">
          <h3 className="text-2xl font-semibold">TriSplit Donation Splitter</h3>
          <div className="grid gap-6 md:grid-cols-3 text-center">
            <div>
              <div className="text-sm text-slate-500">Pending Shares</div>
              <div className="mt-1 text-3xl font-semibold">{loadingPending ? <Skeleton className="h-7 mx-auto w-24" /> : pendingShares ? formatUnits(pendingShares as bigint, 18) : '0'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Price Per Share</div>
              <div className="mt-1 text-3xl font-semibold">{pps ? formatUnits(pps as bigint, 18) : <Skeleton className="h-7 mx-auto w-20" />}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Pending Donation (est.)</div>
              <div className="mt-1 text-3xl font-semibold">{(pendingShares && pps) ? estPendingUSDC : <Skeleton className="h-7 mx-auto w-28" />}</div>
            </div>
          </div>
          <div className="mt-6">
            <Button
              className="w-full"
              disabled={!isConnected || sending || (pendingShares ? ((pendingShares as bigint) === 0n) : true)}
              onClick={async () => {
                try {
                  const tx = await writeContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'distributeAll', args: [] });
                  notifyTx('Distributed', tx);
                  setTimeout(() => {
                    refetchPending();
                    setLogsNonce((n) => n + 1);
                  }, 2500);
                } catch (e: any) {
                  toast.error(e?.shortMessage || e?.message || 'Distribution failed');
                }
              }}
            >
              {sending ? 'Distributing...' : 'Distribute'}
            </Button>
          </div>
        </Card>

        <Card className="space-y-4 p-8">
          <h3 className="text-2xl font-semibold">Recipients & Weights</h3>
          <div className="text-sm text-muted-foreground">Epoch: {currentEpoch?.toString() ?? '...'}</div>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            {(() => {
              const tuple = epochWeights as any;
              const recs = tuple?.[0] as string[] | undefined;
              const bps = tuple?.[1] as number[] | undefined;
              const roles = ['Planters', 'MRV', 'Maintenance'];
              return [0, 1, 2].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="text-muted-foreground">{roles[i]}</div>
                  {recs?.[i] ? (
                    <div className="flex items-center gap-2">
                      {(() => {
                        const meta = getRecipientMeta(recs[i]);
                        if (meta?.logo) return <img src={meta.logo} alt={meta.name} className="h-6 w-6 rounded" />;
                        return (
                          <div className="h-6 w-6 shrink-0 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center text-xs font-semibold">
                            {roles[i][0]}
                          </div>
                        );
                      })()}
                      <a className="text-indigo-600 hover:underline font-mono break-all" href={`https://sepolia.etherscan.io/address/${recs[i]}`} target="_blank" rel="noreferrer" title={recs[i]}>
                        {getRecipientMeta(recs[i])?.name || `${recs[i].slice(0, 6)}…${recs[i].slice(-4)}`}
                      </a>
                    </div>
                  ) : (
                    <Skeleton className="h-6 w-40" />
                  )}
                  <div className="text-xs">{bps?.[i] ?? 0} bps</div>
                </div>
              ));
            })()}
          </div>
        </Card>

        {/* Policy Editor (owner only) */}
        <Card className="space-y-4 p-8">
          <h3 className="text-2xl font-semibold">Next‑epoch Policy Editor</h3>
          <div className="text-sm text-muted-foreground">Epoch {nextEpochArg.toString()} • Owner only</div>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            {(() => {
              const tuple = epochWeights as any;
              const recs = tuple?.[0] as string[] | undefined;
              return [0, 1, 2].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="text-muted-foreground">{['Planters', 'MRV', 'Maintenance'][i]}</div>
                  <div className="font-mono break-all">{recs?.[i] ?? '...'}</div>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    className="w-full rounded border border-gray-300 px-2 py-1"
                    value={[nb0, nb1, nb2][i]}
                    onChange={(e) => ([setNb0, setNb1, setNb2][i])(e.target.value)}
                    disabled={!isOwner}
                  />
                  <div className="text-xs">bps</div>
                </div>
              ));
            })()}
          </div>
          {(() => {
            const s = (parseInt(nb0 || '0') || 0) + (parseInt(nb1 || '0') || 0) + (parseInt(nb2 || '0') || 0);
            const valid = s === 10000;
            return (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Sum: {s} bps {valid ? '' : '• must equal 10000'}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Button
                    disabled={!isOwner || !valid}
                    onClick={async () => {
                      try {
                        const recs = (epochWeights as any)?.[0] as string[] | undefined;
                        if (!recs) throw new Error('Recipients not loaded');
                        const bps: [number, number, number] = [parseInt(nb0 || '0') || 0, parseInt(nb1 || '0') || 0, parseInt(nb2 || '0') || 0];
                        const tx = await writeContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'setEpochWeights', args: [nextEpochArg, recs as any, bps as any] });
                        notifyTx('Policy saved', tx);
                        setTimeout(() => {
                          refetchNextEpochWeights();
                        }, 1500);
                      } catch (e: any) {
                        toast.error(e?.shortMessage || e?.message || 'Save policy failed');
                      }
                    }}
                  >Save Next Policy</Button>
                  <Button
                    variant="outline"
                    disabled={!isOwner}
                    onClick={async () => {
                      try {
                        const tx = await writeContract({ address: splitterAddr, abi: SplitterABI as any, functionName: 'rollEpoch', args: [nextEpochArg] });
                        notifyTx(`Rolled to epoch ${nextEpochArg.toString()}`, tx);
                        setTimeout(() => {
                          refetchCurrentEpoch();
                          refetchEpochWeights();
                          refetchNextEpochWeights();
                          setLogsNonce((n) => n + 1);
                        }, 2500);
                      } catch (e: any) {
                        toast.error(e?.shortMessage || e?.message || 'Roll epoch failed');
                      }
                    }}
                  >Roll to Next Epoch</Button>
                </div>
              </div>
            );
          })()}
        </Card>

        {/* Upcoming policy banner */}
        <Card className="space-y-2 border-indigo-200 bg-indigo-50 p-6">
          <div className="text-sm text-indigo-700">Upcoming Policy • Epoch {nextEpochArg.toString()}</div>
          <div className="text-sm text-slate-700">
            {(() => {
              const bpsArr = (nextEpochWeights as any)?.[1] as number[] | undefined;
              const sum = (bpsArr?.[0] ?? 0) + (bpsArr?.[1] ?? 0) + (bpsArr?.[2] ?? 0);
              if (!bpsArr || sum === 0) return 'Not configured';
              const [b0, b1, b2] = bpsArr as number[];
              return `Planters ${b0} bps • MRV ${b1} bps • Maintenance ${b2} bps`;
            })()}
          </div>
        </Card>
      </section>

      <Separator />

      {/* Impact */}
      <section id="impact" className="container mx-auto px-4 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6 text-center">
            <div className="text-sm text-slate-500">USDC donated this epoch</div>
            <div className="mt-1 text-3xl font-semibold">{epochUsd === null ? '...' : (epochUsd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <div className="text-xs text-slate-500">from Distributed logs</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-sm text-slate-500">Trees this epoch (est.)</div>
            <div className="mt-1 text-3xl font-semibold">{Math.floor(Number(estPendingUSDC) / 1.5) || 0}</div>
            <div className="text-xs text-slate-500">$1.50 per tree</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-sm text-slate-500">Lifetime trees (est.)</div>
            <div className="mt-1 text-3xl font-semibold">{lifetimeUsd === null ? '...' : Math.floor((lifetimeUsd || 0) / 1.5)}</div>
            <div className="text-xs text-slate-500">based on Distributed events</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-slate-500">Receipts (latest)</div>
            <ul className="mt-2 space-y-1 text-xs">
              {recentTxs.length === 0 ? (
                <li className="text-slate-500">No distributions yet</li>
              ) : (
                recentTxs.map((h) => (
                  <li key={h}>
                    <a className="text-indigo-600 hover:underline" href={`https://sepolia.etherscan.io/tx/${h}`} target="_blank" rel="noreferrer">
                      {h.substring(0, 10)}…
                    </a>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </section>

      <Separator />

      {/* FAQ */}
      <section id="faq" className="container mx-auto px-4 py-10">
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          <Card className="p-6"><h4 className="font-semibold">Who holds funds?</h4><p className="mt-1 text-sm text-slate-600">The TokenizedStrategy vault. Users can withdraw anytime subject to strategy liquidity.</p></Card>
          <Card className="p-6"><h4 className="font-semibold">Fees?</h4><p className="mt-1 text-sm text-slate-600">No performance fees — profits are donated. Standard network gas fees apply.</p></Card>
          <Card className="p-6"><h4 className="font-semibold">What chain?</h4><p className="mt-1 text-sm text-slate-600">Sepolia testnet for this demo. Addresses are pre-configured in the UI.</p></Card>
          <Card className="p-6"><h4 className="font-semibold">How donations are split?</h4><p className="mt-1 text-sm text-slate-600">3-way split using basis points per epoch, configurable by management.</p></Card>
        </div>
      </section>
    </div>
  );
}
