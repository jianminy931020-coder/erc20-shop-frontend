import { useEffect } from 'react'
import { formatUnits } from 'viem'
// 把 bigint 价格转成页面可读的 USDT 数字。
import { useAccount, useReadContract } from 'wagmi'
// 这里既要知道当前钱包地址，也要读 hasPurchased 状态。
import { BuyButton } from './BuyButton'
import { PRODUCT_STORE_ADDRESS } from '../config/contracts'
import ProductStoreAbi from '../abis/ProductStore.json'
import type { Product } from '../hooks/useProducts'

interface ProductCardProps {
  product: Product
  // 单个商品的完整展示数据。
  onBuySuccess: () => void
  // 购买完成后向上层抛出成功事件。
  refetchTrigger: number
  // 父层触发刷新信号后，重新读取当前商品的 hasPurchased 状态。
}

export function ProductCard({ product, onBuySuccess, refetchTrigger }: ProductCardProps) {
  const { address } = useAccount()
  // 当前连接地址决定“这个人是不是已经买过该商品”。

  const { data: purchased, refetch: refetchPurchased } = useReadContract({
    address: PRODUCT_STORE_ADDRESS,
    abi: ProductStoreAbi,
    functionName: 'hasPurchased',
    args: address ? [address, product.id] : undefined,
    // 按“当前用户地址 + 当前商品 ID”这个组合去查询是否已购。
    query: { enabled: !!address },
    // 没连接钱包时不查，因为不知道该查谁。
  })

  useEffect(() => {
    if (refetchTrigger > 0 && address) {
      refetchPurchased()
    }
  }, [refetchTrigger, address, refetchPurchased])

  const hasPurchased = !!purchased
  // 统一转成显式布尔值，传给 BuyButton 做状态判断。

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      {/* 商品图片 */}
      <div className="aspect-square bg-gray-100 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
              // 图片挂掉时直接隐藏 img，避免出现默认破图图标。
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">
            🖼️
          </div>
        )}
      </div>

      {/* 商品信息 */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-medium text-gray-900 text-sm">{product.name}</h3>
          <p className="text-xs text-gray-400 mt-1">已售 {product.totalSold.toString()} 件</p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">
            {formatUnits(product.price, 6)}
            {/* USDT 在这里按 6 位精度展示，和链上存储方式对应。 */}
            <span className="text-sm font-normal text-gray-400 ml-1">USDT</span>
          </span>
        </div>

        <BuyButton
          productId={product.id}
          price={product.price}
          hasPurchased={hasPurchased}
          onSuccess={onBuySuccess}
          // BuyButton 内部会根据地址、allowance、购买状态自动切换按钮文案和行为。
        />
      </div>
    </div>
  )
}
