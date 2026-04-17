import { useReadContract } from 'wagmi'
// allowance 是只读查询，所以用 useReadContract。
import { USDT_ADDRESS, PRODUCT_STORE_ADDRESS } from '../config/contracts'
// 授权记录存在 USDT 合约中，被授权方是 ProductStore 合约。
import ERC20Abi from '../abis/ERC20.json'

export function useAllowance(userAddress?: `0x${string}`) {
  const { data, refetch } = useReadContract({
    address: USDT_ADDRESS,
    // allowance 存在 ERC20 合约里，因此读的是 USDT_ADDRESS。
    abi: ERC20Abi,
    functionName: 'allowance',
    args: userAddress ? [userAddress, PRODUCT_STORE_ADDRESS] : undefined,
    // allowance(owner, spender) 的 owner 是用户地址，spender 是商店合约地址。
    query: { enabled: !!userAddress },
    // 钱包没连接时不发请求，避免产生无意义查询。
  })

  return {
    allowance: (data as bigint | undefined) ?? 0n,
    // 初次无数据时按 0 授权处理，按钮状态会自然显示为“去授权”。
    refetch,
    // approve 成功后需要手动刷新 allowance，按钮才能从“授权”切到“购买”。
  }
}
