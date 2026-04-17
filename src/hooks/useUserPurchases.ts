import { useReadContract } from 'wagmi'
// 用链上只读调用获取某个用户已买过的完整商品列表。
import { PRODUCT_STORE_ADDRESS } from '../config/contracts'
import ProductStoreAbi from '../abis/ProductStore.json'
import type { Product } from './useProducts'
// 复用 Product 类型，避免在多个文件重复声明同一结构。

export function useUserPurchases(userAddress?: `0x${string}`) {
  const { data, isLoading, refetch } = useReadContract({
    address: PRODUCT_STORE_ADDRESS,
    abi: ProductStoreAbi,
    functionName: 'getUserPurchasedProducts',
    args: userAddress ? [userAddress] : undefined,
    // 只有拿到当前钱包地址时，才知道应该查谁的已购记录。
    query: { enabled: !!userAddress },
    // 未连接钱包时不发查询，这样页面更省请求也更符合语义。
  })

  return {
    purchases: (data as Product[] | undefined) ?? [],
    // 初始阶段先返回空数组，组件里可以直接安全渲染。
    isLoading,
    refetch,
    // 购买成功后可以手动触发刷新，让新购商品马上出现在列表里。
  }
}
