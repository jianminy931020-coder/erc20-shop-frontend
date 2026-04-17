import { useReadContract } from 'wagmi'
// 用 wagmi 封装链上只读调用，把合约查询变成 React 友好的数据源。
import { PRODUCT_STORE_ADDRESS } from '../config/contracts'
// 商品信息都存储在 ProductStore 合约里。
import ProductStoreAbi from '../abis/ProductStore.json'
// ABI 决定前端如何正确调用 getAllProducts。

export interface Product {
  id: bigint
  // 合约里商品的唯一编号。
  name: string
  // 商品名称。
  imageUrl: string
  // 商品图片地址。
  price: bigint
  // 原始链上价格，单位还是最小精度。
  isActive: boolean
  // 是否上架。
  totalSold: bigint
  // 总销量。
}

export function useProducts() {
  const { data, isLoading, refetch } = useReadContract({
    address: PRODUCT_STORE_ADDRESS,
    // 读商品列表时，目标地址就是 ProductStore。
    abi: ProductStoreAbi,
    functionName: 'getAllProducts',
    // 一次性拿回所有商品，适合当前规模较小的商品目录。
  })

  const products = (data as Product[] | undefined) ?? []
  // 初次加载前 data 可能是 undefined，这里统一兜底为空数组。
  const activeProducts = products.filter((p) => p.isActive)
  // 前端只展示上架商品，避免把下架项也渲染出来。

  return { products: activeProducts, isLoading, refetch }
  // refetch 暴露出去，方便后面按需手动刷新列表。
}
