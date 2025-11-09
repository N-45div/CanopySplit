import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { createPublicClient, http, formatUnits } from 'viem';
import { parseAbiItem } from 'viem';
import ERC20ABI from '@/abis/ERC20.json';

export default function Hooks() {
  const [rpcUrl, setRpcUrl] = useState('http://127.0.0.1:8545');
  const [hookAddr, setHookAddr] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [tokenMeta, setTokenMeta] = useState<{ [token: string]: { decimals: number; symbol: string } }>({});

  const client = useMemo(() => createPublicClient({ transport: http(rpcUrl) }), [rpcUrl]);
  const donationExecuted = useMemo(() => parseAbiItem('event DonationExecuted(bytes32 indexed id, address token, address target, uint256 amount)'), []);

  const load = async () => {
    if (!hookAddr) return;
    setLoading(true);
    try {
      const evts = await client.getLogs({ address: hookAddr as `0x${string}`, event: donationExecuted, fromBlock: 0n });
      setLogs(evts);
      const tokens = Array.from(new Set(evts.map((e) => e.args.token as string))).filter(Boolean);
      const meta: { [token: string]: { decimals: number; symbol: string } } = {};
      for (const t of tokens) {
        try {
          const [decimals, symbol] = await Promise.all([
            client.readContract({ address: t as `0x${string}`, abi: ERC20ABI as any, functionName: 'decimals' }),
            client.readContract({ address: t as `0x${string}`, abi: ERC20ABI as any, functionName: 'symbol' }),
          ]);
          meta[t] = { decimals: (decimals as number) ?? 18, symbol: (symbol as string) || 'ASSET' };
        } catch {}
      }
      setTokenMeta(meta);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer: any;
    if (hookAddr) {
      load();
      timer = setInterval(load, 5000);
    }
    return () => timer && clearInterval(timer);
  }, [hookAddr, rpcUrl]);

  const totalByToken = useMemo(() => {
    const m: { [token: string]: bigint } = {};
    logs.forEach((l) => {
      const t = l.args.token as string;
      const amt = l.args.amount as bigint;
      m[t] = (m[t] || 0n) + amt;
    });
    return m;
  }, [logs]);

  return (
    <div className="container mx-auto min-h-[calc(100vh-56px-88px)] space-y-8 px-4 py-10">
      <section>
        <h1 className="text-4xl font-bold">Hooks Demo</h1>
        <p className="text-slate-600">View live donations emitted by a Uniswap v4 swap hook on a local RPC.</p>
      </section>

      <Card className="p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-sm text-slate-500">Local RPC URL</div>
            <Input value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} placeholder="http://127.0.0.1:8545" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="text-sm text-slate-500">Hook Address</div>
            <Input value={hookAddr} onChange={(e) => setHookAddr(e.target.value)} placeholder="0x..." />
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={load} disabled={!hookAddr || loading}>{loading ? 'Loading...' : 'Load'}</Button>
        </div>
      </Card>

      <Separator />

      <section className="grid gap-6 md:grid-cols-3">
        {Object.entries(totalByToken).map(([token, total]) => {
          const meta = tokenMeta[token] || { decimals: 18, symbol: 'ASSET' };
          const fmt = formatUnits(total, meta.decimals);
          return (
            <Card key={token} className="p-6 text-center">
              <div className="text-sm text-slate-500">Total Donated</div>
              <div className="mt-1 text-3xl font-semibold">{fmt}</div>
              <div className="text-xs text-slate-500">{meta.symbol}</div>
            </Card>
          );
        })}
      </section>

      <section className="space-y-3">
        <h3 className="text-2xl font-semibold">Recent Donations</h3>
        <Card className="p-0 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2">PoolId</th>
                <th className="px-4 py-2">Token</th>
                <th className="px-4 py-2">Target</th>
                <th className="px-4 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(-20).reverse().map((l, i) => {
                const token = l.args.token as string;
                const target = l.args.target as string;
                const amount = l.args.amount as bigint;
                const id = l.args.id as string;
                const meta = tokenMeta[token] || { decimals: 18, symbol: 'ASSET' };
                return (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2 font-mono">{id.slice(0, 10)}…</td>
                    <td className="px-4 py-2 font-mono">{token.slice(0, 8)}…</td>
                    <td className="px-4 py-2 font-mono">{target.slice(0, 8)}…</td>
                    <td className="px-4 py-2">{formatUnits(amount, meta.decimals)} {meta.symbol}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
