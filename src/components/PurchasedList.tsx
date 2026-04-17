import { useEffect } from 'react'
import { formatUnits } from 'viem'
// 用于把链上 bigint 价格转成展示字符串。
import { useAccount } from 'wagmi'
import { useUserPurchases } from '../hooks/useUserPurchases'

interface PurchasedListProps {
  refetchTrigger: number
  // 父组件购买成功后会递增这个值，作为一个外部刷新信号。
}

export function PurchasedList({ refetchTrigger }: PurchasedListProps) {
  const { address } = useAccount()
  const { purchases, isLoading, refetch } = useUserPurchases(address)
  // 已购列表只跟当前连接钱包绑定。

  // 外部触发刷新：只有当触发器变化后，才执行一次 refetch，避免在渲染阶段触发副作用。
  useEffect(() => {
    if (refetchTrigger > 0) {
      refetch()
      // 这样做的目的是：用户买完商品后，已购区域能立刻显示新结果，不用手动刷新页面。
    }
  }, [refetchTrigger, refetch])

  if (!address) return null
  // 没连接钱包时没有“我的购买记录”这个概念，因此不渲染。

  if (isLoading) {
    return (
      <div className="mt-10">
        <h2 className="text-base font-semibold text-gray-900 mb-4">我已购买的商品</h2>
        <div className="flex gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="w-32 rounded-xl border border-gray-200 overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-100" />
              <div className="p-3">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (purchases.length === 0) return null
  // 没有购买记录时直接隐藏整个模块，页面会更简洁。

  return (
    <div className="mt-10">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        我已购买的商品
        <span className="ml-2 text-sm font-normal text-gray-400">({purchases.length} 件)</span>
      </h2>
      <div className="flex flex-wrap gap-4">
        {purchases.map((product, i) => (
          <div key={`${product.id.toString()}-${i}`} className="w-36 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="aspect-square bg-gray-100 overflow-hidden">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                    // 与商品卡片保持一致的容错策略，图片失败也不影响整体布局。
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">
                  🖼️
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-xs font-medium text-gray-900 truncate">{product.name}</p>
              <p className="text-xs text-gray-400 mt-1">{formatUnits(product.price, 6)} USDT</p>
              <span className="inline-block mt-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                ✓ 已购买
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
