import { useEffect } from 'react'
// 用副作用在交易状态变化后执行刷新动作。
import { useAccount } from 'wagmi'
// 用来判断用户是否已连接钱包。
import { formatUnits } from 'viem'
// 用于把价格渲染成按钮上的可读文案。
import { useAllowance } from '../hooks/useAllowance'
// 查询当前地址是否已授权足够 USDT 给商店合约。
import { useApprove } from '../hooks/useApprove'
// 封装 approve 交易发送与确认状态。
import { useBuyProduct } from '../hooks/useBuyProduct'
// 封装 buyProduct 交易发送与确认状态。

interface BuyButtonProps {
  productId: bigint
  // 当前商品 ID，购买时传给合约。
  price: bigint
  // 当前商品价格，用于授权额度和购买文案。
  hasPurchased: boolean
  // 外层组件已经帮我们查好了“当前用户是否买过”。
  onSuccess: () => void
  // 购买成功后回调给父组件，触发其它区域刷新。
}

export function BuyButton({ productId, price, hasPurchased, onSuccess }: BuyButtonProps) {
  const { address } = useAccount()
  // 当前地址是按钮状态机的第一层判断条件。
  const { allowance, refetch: refetchAllowance } = useAllowance(address)
  // allowance 决定当前是该显示“授权”还是“购买”。

  // isPending,       // 签名中（用户在钱包确认，交易可能还没发出去） isApproving
  // isConfirming,    // tx 已发出，等待确认 ，签名中（用户在钱包确认，交易可能还没发出去） isApproveConfirming
  // isSuccess,       // 交易已被链确认成功（至少 1 个确认） approveSuccess
  const { approve, isPending: isApproving, isConfirming: isApproveConfirming, isSuccess: approveSuccess } = useApprove()
  // approve 拆成三种状态：签名中、确认中、成功。
  const { buyProduct, isPending: isBuying, isConfirming: isBuyConfirming, isSuccess: buySuccess } = useBuyProduct()
  // buyProduct 也有同样的状态拆分，便于给用户更准确的反馈。

  const hasEnoughAllowance = allowance >= price
  // 只有授权额度大于等于商品价格，才允许进入购买按钮状态。

  // approve 完成后刷新 allowance
  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance()
      // 授权成功后立刻刷新 allowance，否则按钮仍可能停留在旧的“去授权”状态。
    }
  }, [approveSuccess, refetchAllowance])

  // buy 完成后通知父组件刷新
  useEffect(() => {
    if (buySuccess) {
      onSuccess()
      // 购买成功后通知父组件刷新已购列表等依赖购买结果的数据。
    }
  }, [buySuccess, onSuccess])

  if (!address) {
    return (
      <button disabled className="w-full py-2 rounded-lg bg-gray-100 text-gray-400 text-sm cursor-not-allowed">
        请先连接钱包
      </button>
    )
  }

  if (hasPurchased) {
    return (
      <button disabled className="w-full py-2 rounded-lg bg-green-50 text-green-600 text-sm border border-green-200 cursor-not-allowed">
        ✓ 已购买
      </button>
    )
  }

  // allowance 不足 → 显示 Approve 按钮
  if (!hasEnoughAllowance) {
    const isLoading = isApproving || isApproveConfirming
    // 只要在钱包签名或链上确认阶段，都要禁用按钮，避免重复发交易。
    return (
      <button
        onClick={() => approve(price)}
        // 这里授权的是当前商品价格，不是无限额度，更适合演示和教学场景。
        disabled={isLoading}
        className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium transition-colors"
      >
        {isApproving ? '签名中...' : isApproveConfirming ? '确认中...' : `授权 ${formatUnits(price, 6)} USDT`}
        {/* “签名中”表示用户还在钱包确认；“确认中”表示交易已发出，正在等链上打包。 */}
      </button>
    )
  }

  // allowance 足够 → 显示购买按钮
  const isLoading = isBuying || isBuyConfirming
  // 购买按钮同样要在交易处理中禁用，防止重复点击导致多次购买。
  return (
    <button
      onClick={() => buyProduct(productId)}
      // buyProduct 只需要商品 ID，实际扣款金额由合约内部读取商品价格并执行 transferFrom。
      disabled={isLoading}
      className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium transition-colors"
    >
      {isBuying ? '签名中...' : isBuyConfirming ? '确认中...' : `购买 ${formatUnits(price, 6)} USDT`}
    </button>
  )
}
