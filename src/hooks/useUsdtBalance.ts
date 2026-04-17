import { useReadContract } from 'wagmi'
// 余额是链上只读数据，因此用 useReadContract 即可。
import { USDT_ADDRESS } from '../config/contracts'
import ERC20Abi from '../abis/ERC20.json'
import { formatUnits } from 'viem'
// viem 提供精度格式化工具，把 bigint 转成用户可读字符串。

export function useUsdtBalance(userAddress?: `0x${string}`) {
  const { data } = useReadContract({
    address: USDT_ADDRESS,
    // 用户的余额记录在 USDT 合约中，不在本地钱包里。
    abi: ERC20Abi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    // balanceOf 只需要一个目标地址参数。
    query: { enabled: !!userAddress },
    // 钱包未连接时没有地址可查，所以禁用查询。
  })

  const raw = (data as bigint | undefined) ?? 0n
  // 保留原始 bigint，方便需要精确比较时继续使用。
  const formatted = formatUnits(raw, 6)
  // 按 USDT 的 6 位精度格式化，便于 UI 直接展示。

  return { raw, formatted }
}
