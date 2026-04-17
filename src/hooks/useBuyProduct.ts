import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
// buyProduct 和 approve 一样，也要分为“提交交易”和“等待确认”两个阶段。
import { PRODUCT_STORE_ADDRESS } from '../config/contracts'
// buyProduct 是 ProductStore 合约的方法。
import ProductStoreAbi from '../abis/ProductStore.json'

export function useBuyProduct() {
  const { writeContract, data: txHash, isPending } = useWriteContract()
  // isPending 表示用户还在钱包里签名，或者交易刚准备发出。

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    // 等待 buyProduct 交易被矿工打包确认，成功后页面才适合刷新购买结果。
  })

  const buyProduct = (productId: bigint) => {
    writeContract({
      address: PRODUCT_STORE_ADDRESS,
      abi: ProductStoreAbi,
      functionName: 'buyProduct',
      args: [productId],
      // 只需要传商品 ID，价格和扣款逻辑由合约内部处理。
    })
  }

  return {
    buyProduct,
    isPending,
    isConfirming,
    isSuccess,
  }
}
