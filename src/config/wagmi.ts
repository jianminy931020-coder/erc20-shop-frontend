import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia } from 'wagmi/chains'
import { http } from 'wagmi'

// RainbowKit 帮我们生成一套开箱即用的钱包连接配置，避免手写 connector 细节。
// 指定 transports 使用自己的 Infura RPC，避免默认公共节点不稳定导致合约读取失败。
export const wagmiConfig = getDefaultConfig({
  appName: 'ERC20 Shop',
  projectId: 'erc20shop',
  chains: [sepolia],
  transports: {
    // 用 .env 里的 Infura RPC，稳定性远高于默认公共节点
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL),
  },
  ssr: false,
})
