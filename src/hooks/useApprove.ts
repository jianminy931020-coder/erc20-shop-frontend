import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
// 把“发交易”和“等确认”拆成两个阶段，UI 才能给出更细的状态提示。
import { USDT_ADDRESS, PRODUCT_STORE_ADDRESS } from '../config/contracts'
// approve 的目标合约是 USDT，被授权方是 ProductStore。
import ERC20Abi from '../abis/ERC20.json'

export function useApprove() {
  const { writeContract, data: txHash, isPending } = useWriteContract()
  // isPending 代表钱包签名/发交易阶段，用户可能还在钱包里确认。

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    // 拿到交易哈希后继续监听，直到这笔 approve 真正被链确认。
  })

  const approve = (price: bigint) => {
    // 当前实现按“当前商品价格”去授权，而不是直接无限授权。
    // 这样更安全，也更符合教学型示例 DApp 的意图。
    writeContract({
      address: USDT_ADDRESS,
      abi: ERC20Abi,
      functionName: 'approve',
      args: [PRODUCT_STORE_ADDRESS, price],
      // 参数顺序固定是 spender 在前、amount 在后。
    })
  }

  return {
    approve,
    isPending,       // 用户在钱包签名中
    isConfirming,    // tx 已发出，等待确认
    isSuccess,       // approve 完成
  }
}
