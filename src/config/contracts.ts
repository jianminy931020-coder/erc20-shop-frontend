export const PRODUCT_STORE_ADDRESS = '0xE76d2a3Ca31fDDf86A5dD8350596A8564fF3a78d' as const
// 已部署到 Sepolia 的 ProductStore 合约地址，商品列表和购买写入都走这个地址。
export const USDT_ADDRESS = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0' as const
// 用于支付的 USDT 合约地址，余额、授权和 approve 都发生在这里。

// USDT 精度：6位
export const USDT_DECIMALS = 6
// 单独抽常量是为了避免项目里重复写“6”，后续切换代币也更好维护。
