import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { PRODUCT_STORE_ADDRESS } from '../config/contracts'
import ProductStoreAbi from '../abis/ProductStore.json'

export function useToggleProduct() {
  const { writeContract, data: txHash, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  const toggleProduct = (productId: bigint) => {
    writeContract({
      address: PRODUCT_STORE_ADDRESS,
      abi: ProductStoreAbi,
      functionName: 'toggleProduct',
      args: [productId],
    })
  }

  return { toggleProduct, isPending, isConfirming, isSuccess }
}
