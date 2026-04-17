import { useState, useEffect } from 'react'
import { formatUnits } from 'viem'
import { useAddProduct } from '../hooks/useAddProduct'
import { useToggleProduct } from '../hooks/useToggleProduct'
import { useReadContract } from 'wagmi'
import { PRODUCT_STORE_ADDRESS } from '../config/contracts'
import ProductStoreAbi from '../abis/ProductStore.json'
import type { Product } from '../hooks/useProducts'

interface AdminPanelProps {
  onProductAdded: () => void
}

export function AdminPanel({ onProductAdded }: AdminPanelProps) {
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [price, setPrice] = useState('')
  const [activeTab, setActiveTab] = useState<'add' | 'manage'>('add')

  const { addProduct, isPending, isConfirming, isSuccess } = useAddProduct()
  const { toggleProduct, isPending: isToggling, isSuccess: toggleSuccess } = useToggleProduct()

  // 管理列表需要看所有商品（含下架）
  const { data: allProductsRaw } = useReadContract({
    address: PRODUCT_STORE_ADDRESS,
    abi: ProductStoreAbi,
    functionName: 'getAllProducts',
  })
  const allProducts = (allProductsRaw as Product[] | undefined) ?? []

  // 添加成功后清空表单 + 通知父组件刷新
  useEffect(() => {
    if (isSuccess) {
      setName('')
      setImageUrl('')
      setPrice('')
      onProductAdded()
    }
  }, [isSuccess, onProductAdded])

  // 上下架成功后刷新列表
  useEffect(() => {
    if (toggleSuccess) {
      onProductAdded()
    }
  }, [toggleSuccess, onProductAdded])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !price) return
    addProduct(name.trim(), imageUrl.trim(), price)
  }

  const isLoading = isPending || isConfirming

  return (
    <div className="bg-white border border-orange-200 rounded-xl overflow-hidden mb-8">
      {/* 面板标题 */}
      <div className="bg-orange-50 border-b border-orange-200 px-6 py-4 flex items-center gap-2">
        <span className="text-orange-600 font-bold text-sm">🔑 Owner 管理面板</span>
        <span className="text-orange-400 text-xs">仅合约 owner 可见</span>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('add')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'add'
              ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ＋ 添加商品
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'manage'
              ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📦 商品管理 ({allProducts.length})
        </button>
      </div>

      {/* 添加商品 Tab */}
      {activeTab === 'add' && (
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 商品名称 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">商品名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：NFT 周边 T恤"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
                disabled={isLoading}
              />
            </div>

            {/* 价格 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">价格（USDT）*</label>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-100">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="10"
                  min="0.000001"
                  step="0.000001"
                  className="flex-1 px-3 py-2 text-sm outline-none"
                  disabled={isLoading}
                />
                <span className="px-3 text-sm text-gray-400 bg-gray-50 border-l border-gray-200 py-2">USDT</span>
              </div>
            </div>
          </div>

          {/* 图片地址 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">图片 URL（可选）</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.png"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
              disabled={isLoading}
            />
          </div>

          {/* 图片预览 */}
          {imageUrl && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">预览：</span>
              <img
                src={imageUrl}
                alt="预览"
                className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}

          {/* 状态提示 */}
          {isSuccess && (
            <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              ✓ 商品添加成功，已上架
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={isLoading || !name.trim() || !price}
            className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {isPending ? '签名中...' : isConfirming ? '上链确认中...' : '添加商品'}
          </button>
        </form>
      )}

      {/* 商品管理 Tab */}
      {activeTab === 'manage' && (
        <div className="p-6">
          {allProducts.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">还没有商品，先去添加吧</p>
          ) : (
            <div className="space-y-3">
              {allProducts.map((product) => (
                <div
                  key={product.id.toString()}
                  className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  {/* 缩略图 */}
                  <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">🖼️</div>
                    )}
                  </div>

                  {/* 商品信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      <span className="text-gray-400 mr-1">#{product.id.toString()}</span>
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatUnits(product.price, 6)} USDT · 已售 {product.totalSold.toString()} 件
                    </p>
                  </div>

                  {/* 状态 + 操作 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        product.isActive
                          ? 'text-green-600 bg-green-50 border-green-200'
                          : 'text-gray-400 bg-gray-50 border-gray-200'
                      }`}
                    >
                      {product.isActive ? '上架' : '下架'}
                    </span>
                    <button
                      onClick={() => toggleProduct(product.id)}
                      disabled={isToggling}
                      className="text-xs px-3 py-1 rounded-lg border border-gray-200 hover:border-orange-300 hover:text-orange-600 text-gray-500 transition-colors disabled:opacity-50"
                    >
                      {product.isActive ? '下架' : '上架'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
