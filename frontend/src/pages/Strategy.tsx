import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import StrategyABI from '@/abis/YieldDonatingTokenizedStrategy.json';
import ERC20ABI from '@/abis/ERC20.json';
import { ADDRS } from '@/config/contracts';
import { formatUnits, parseUnits } from 'viem';
import { toast } from 'sonner';

export default function StrategyPage() {
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');

  const strategyAddr = ADDRS.sepolia.strategy as `0x${string}`;
  const usdcAddr = ADDRS.sepolia.usdc as `0x${string}`;

  const { address: account, isConnected } = useAccount();
  const { data: asset } = useReadContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'asset', args: [] });
  const { data: totalAssets } = useReadContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'totalAssets', args: [] });
  const { data: assetDecimals } = useReadContract({ address: asset as any, abi: ERC20ABI as any, functionName: 'decimals', args: [] });
  const { data: assetSymbol } = useReadContract({ address: asset as any, abi: ERC20ABI as any, functionName: 'symbol', args: [] });
  const dec = typeof assetDecimals === 'number' ? assetDecimals : 18;
  const symbol = (assetSymbol as string) || 'ASSET';

  const { writeContract, isPending } = useWriteContract();

  return (
    <div className="container mx-auto min-h-[calc(100vh-56px-88px)] space-y-10 px-4 py-10">
      <section>
        <h1 className="text-4xl font-bold">Strategy</h1>
        <p className="text-slate-600">Deposit/withdraw {symbol} and view live status.</p>
      </section>

      <section className="space-y-6">
        <Card className="p-8">
          <h3 className="text-2xl font-semibold">Status</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <div className="text-muted-foreground">Strategy</div>
              <div className="font-mono break-all">{strategyAddr}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Asset</div>
              <div className="font-mono break-all">{(asset as string) || '...'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Assets</div>
              <div className="font-mono">{totalAssets ? formatUnits(totalAssets as bigint, dec) : '0'}</div>
            </div>
          </div>
        </Card>
      </section>

      <Separator />

      <section className="space-y-6">
        <Card className="space-y-6 p-8">
          <h3 className="text-2xl font-semibold">Actions</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="text-muted-foreground">Deposit {symbol}</div>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2"
                placeholder={`Amount (${symbol})`}
                value={depositAmt}
                onChange={(e) => setDepositAmt(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={!isConnected || isPending || !depositAmt}
                onClick={async () => {
                  try {
                    const amt = parseUnits(depositAmt as `${string}` as string, dec);
                    await writeContract({ address: usdcAddr, abi: ERC20ABI as any, functionName: 'approve', args: [strategyAddr, amt] });
                    const tx = await writeContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'deposit', args: [amt, account!] });
                    toast.success(`Deposited. Tx: ${tx}`);
                  } catch (e: any) {
                    toast.error(e?.shortMessage || e?.message || 'Deposit failed');
                  }
                }}
              >
                {isPending ? 'Processing...' : 'Approve & Deposit'}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="text-muted-foreground">Withdraw Assets</div>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2"
                placeholder={`Amount (${symbol})`}
                value={withdrawAmt}
                onChange={(e) => setWithdrawAmt(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={!isConnected || isPending || !withdrawAmt}
                onClick={async () => {
                  try {
                    const amt = parseUnits(withdrawAmt as `${string}` as string, dec);
                    const tx = await writeContract({ address: strategyAddr, abi: StrategyABI as any, functionName: 'withdraw', args: [amt, account!, account!] });
                    toast.success(`Withdrawn. Tx: ${tx}`);
                  } catch (e: any) {
                    toast.error(e?.shortMessage || e?.message || 'Withdraw failed');
                  }
                }}
              >
                {isPending ? 'Processing...' : 'Withdraw'}
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
