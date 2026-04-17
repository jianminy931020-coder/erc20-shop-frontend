import { ConnectButton } from '@rainbow-me/rainbowkit'
// RainbowKit 自带的钱包连接按钮。
import { useAccount } from 'wagmi'
// 用来读取当前连接的钱包地址。
import { useUsdtBalance } from '../hooks/useUsdtBalance'
// 顶栏会显示当前地址持有的 USDT 余额。

export function Header() {
  const { address } = useAccount()
  // address 存在表示用户已经连接钱包。
  const { formatted } = useUsdtBalance(address)
  // 把地址传给余额 hook，连接后自动查询链上余额。

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-gray-900">ERC20 Shop</span>
          <span className="text-sm text-gray-400">on Sepolia</span>
        </div>

        <div className="flex items-center gap-4">
          {address && (
            <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
              {/* 这里把余额限制到两位小数，主要是为了界面可读性。 */}
              USDT: <span className="font-medium text-gray-900">{parseFloat(formatted).toFixed(2)}</span>
            </div>
          )}
          {/* ConnectButton 会自动根据状态显示“连接钱包 / 已连接 / 切换网络”等 UI。 */}
          <ConnectButton />
        </div>
      </div>
    </header>
  )
}
