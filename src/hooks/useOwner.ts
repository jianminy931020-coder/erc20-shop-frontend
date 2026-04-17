import { useReadContract, useAccount } from 'wagmi'
import { PRODUCT_STORE_ADDRESS } from '../config/contracts'
import ProductStoreAbi from '../abis/ProductStore.json'

export function useOwner() {
  const { address } = useAccount()

  // 读取合约 owner 地址
  const { data: ownerAddress, isLoading, error } = useReadContract({
    address: PRODUCT_STORE_ADDRESS,
    abi: ProductStoreAbi,
    functionName: 'owner',
  })

  // 当前连接钱包是否是 owner（地址不区分大小写比较）
  const isOwner =
    !!address &&
    !!ownerAddress &&
    address.toLowerCase() === (ownerAddress as string).toLowerCase()

  return {
    ownerAddress: ownerAddress as `0x${string}` | undefined,
    isOwner,
    isLoading,
    error,
  }
}
