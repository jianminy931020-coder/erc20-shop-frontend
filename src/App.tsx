import { useState } from 'react'
// 用一个简单的数字触发器，协调购买成功后的局部刷新。
import { Header } from './components/Header'
// 顶部栏：标题、网络标识、余额、连接钱包。
import { ProductList } from './components/ProductList'
// 商品展示列表。
import { PurchasedList } from './components/PurchasedList'
// 当前钱包已购买商品列表。
import { AdminPanel } from './components/AdminPanel'
// Owner 专属管理面板，普通用户不可见。
import { useOwner } from './hooks/useOwner'
import { useAccount } from 'wagmi'
import { PRODUCT_STORE_ADDRESS } from './config/contracts'
// 检测当前连接钱包是否是合约 owner。

export default function App() {
  const [refetchTrigger, setRefetchTrigger] = useState(0)
  // 这里不直接把 refetch 函数跨多层传递，而是传一个"状态变化信号"给子组件。

  const { isOwner, ownerAddress, error: ownerError } = useOwner()
  const { address } = useAccount()
  // isOwner = true 时才渲染管理面板，普通用户看不到。

  const handleRefresh = () => {
    setRefetchTrigger((n) => n + 1)
    // 购买成功 / 添加商品成功后统一触发刷新。
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header 不依赖商品列表刷新，单独放页面顶部。 */}
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* 调试信息：确认 owner 地址读取状态 —— 问题修复后删掉这块 */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 space-y-1">
          <p>🔍 合约 owner：<span className="font-mono">{ownerAddress ?? '读取中...'}</span></p>
          <p>🔍 当前钱包：<span className="font-mono">{address ?? '未连接'}</span></p>
          <p>🔍 isOwner：<span className="font-bold">{String(isOwner)}</span></p>
          <p>🔍 合约地址：<span className="font-mono">{PRODUCT_STORE_ADDRESS}</span></p>
          {ownerError && <p className="text-red-600">❌ 错误：{ownerError.message}</p>}
        </div>

        {/* Owner 管理面板：只有合约 owner 连接钱包后才显示 */}
        {isOwner && (
          <AdminPanel onProductAdded={handleRefresh} />
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-6">商品列表</h1>
        {/* 商品购买成功后会回调到这里，再由 App 统一通知其它区域刷新。 */}
        <ProductList onBuySuccess={handleRefresh} refetchTrigger={refetchTrigger} />
        {/* 已购列表通过 refetchTrigger 感知外部刷新需求，购买后立即同步最新链上数据。 */}
        <PurchasedList refetchTrigger={refetchTrigger} />
      </main>
    </div>
  )
}
