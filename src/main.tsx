import { StrictMode } from 'react'
// React 严格模式会在开发环境帮助我们发现潜在副作用和不安全用法。
import { createRoot } from 'react-dom/client'
// React 18 之后的应用挂载入口。
import { WagmiProvider } from 'wagmi'
// 提供钱包连接、链信息、读写合约等 wagmi 上下文。
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// wagmi 很多查询能力依赖 TanStack Query 做缓存、刷新和状态管理。 异步状态管理，wagmi 内部依赖它缓存链上数据
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
// 提供钱包连接弹窗和按钮 UI 上下文。
import '@rainbow-me/rainbowkit/styles.css'
// RainbowKit 默认样式。
import { wagmiConfig } from './config/wagmi'
// 导入我们在配置层定义好的链和钱包设置。
import App from './App.tsx'
// 页面根组件。
import './index.css'
// 全局样式入口。

const queryClient = new QueryClient()
// 创建全局 QueryClient，统一管理查询缓存。

createRoot(document.getElementById('root')!).render(
  // 把整个 React 应用挂载到 index.html 里的 root 节点。
  <StrictMode>
    <WagmiProvider config={wagmiConfig}> {/* 提供链/钱包上下文 */}
      <QueryClientProvider client={queryClient}> {/* 提供缓存上下文 */}
        <RainbowKitProvider>   {/* 提供钱包 UI 上下文，让 ConnectButton 等组件正常工作 */}
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
