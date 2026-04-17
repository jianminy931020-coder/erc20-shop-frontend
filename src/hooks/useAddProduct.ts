import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { PRODUCT_STORE_ADDRESS } from '../config/contracts'
import ProductStoreAbi from '../abis/ProductStore.json'

export function useAddProduct() {
  const { writeContract, data: txHash, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // priceUSDT 传入人类可读的 USDT 数字，比如 "10.5"
  // 内部自动转成 6 位精度的 bigint
  const addProduct = (name: string, imageUrl: string, priceUSDT: string) => {
    const price = parseUnits(priceUSDT, 6)
    writeContract({
      address: PRODUCT_STORE_ADDRESS,
      abi: ProductStoreAbi,
      functionName: 'addProduct',
      args: [name, imageUrl, price],
    })
  }

  return {
    addProduct,
    isPending,     // 用户在钱包签名中
    isConfirming,  // tx 已发出，等待确认
    isSuccess,     // 添加成功
    txHash,
  }
}
