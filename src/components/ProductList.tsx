import { useEffect } from 'react'
import { useProducts } from '../hooks/useProducts'
// 组件不自己管链上细节，而是把数据获取交给自定义 hook。
import { ProductCard } from './ProductCard'
// 列表里的每一项都拆成单独卡片组件，便于复用和维护。

interface ProductListProps {
  onBuySuccess: () => void
  // 购买成功后通知父组件做联动刷新。
  refetchTrigger: number
  // 父组件触发刷新信号（购买成功/发布成功）时，列表重新拉取链上商品数据。
}

export function ProductList({ onBuySuccess, refetchTrigger }: ProductListProps) {
  const { products, isLoading, refetch } = useProducts()
  // 拿到上架商品列表和加载状态。

  useEffect(() => {
    if (refetchTrigger > 0) {
      refetch()
    }
  }, [refetchTrigger, refetch])

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
            <div className="aspect-square bg-gray-100" />
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-9 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        {/* 空状态比直接一片空白更能说明“当前没有商品”。 */}
        <p className="text-4xl mb-3">🛒</p>
        <p>暂无上架商品</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        // 用链上的商品 ID 作为 key，保证 React diff 更稳定。
        <ProductCard
          key={product.id.toString()}
          product={product}
          onBuySuccess={onBuySuccess}
          refetchTrigger={refetchTrigger}
        />
      ))}
    </div>
  )
}
