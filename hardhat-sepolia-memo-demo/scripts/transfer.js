import 'dotenv/config'
import { ethers } from 'ethers'

import { encode } from '../utils/memoCodec.js'

// 读取必填环境变量，不存在就直接报错，避免发出错误交易。
function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

async function main() {
  // ===== 流程总览（映射到本文件）=====
  // [A] 读取环境变量: INFURA_KEY / PRIVATE_KEY / TO_ADDRESS
  // [B] 连接 Infura RPC（相当于“快递站”入口）
  // [C] 用私钥创建 Wallet（本地签名者；这里不是 MetaMask 弹窗签名）
  // [D] 编码备注为 data
  // [E] 组装交易对象 tx
  // [F] sendTransaction: ethers 内部完成“签名 rawTx + 发给 Infura(eth_sendRawTransaction)”
  // [G] 等待链上打包回执
  // [H] 打印 txHash（由 RPC 返回）

  // 1) 加载基础配置（Infura、私钥、目标地址）
  const infuraKey = requireEnv('INFURA_KEY')
  const privateKey = requireEnv('PRIVATE_KEY')
  const toAddress = requireEnv('TO_ADDRESS')

  // 2) 参数校验：私钥格式必须是 0x + 64位十六进制。
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('PRIVATE_KEY format is invalid. Expected 0x + 64 hex chars.')
  }

  // 3) 参数校验：目标地址必须是合法 EVM 地址。
  if (!ethers.isAddress(toAddress)) {
    throw new Error('TO_ADDRESS is not a valid Ethereum address.')
  }

  // 4) [B] 连接 Sepolia 的 Infura RPC。
  // 这里就是把请求发到 https://sepolia.infura.io/v3/<INFURA_KEY>
  const rpcUrl = `https://sepolia.infura.io/v3/${infuraKey}`
  const provider = new ethers.JsonRpcProvider(rpcUrl)

  // 4) [C] 用私钥创建 signer。
  // 注意：这是“本地私钥签名”模式，不是 MetaMask 插件弹窗签名模式。
  const wallet = new ethers.Wallet(privateKey, provider)

  // 5) 对备注做 XOR 编码，得到可直接放进交易 data 的十六进制字符串。
  const memoText = process.env.MEMO_TEXT ?? '备注'
  const memoKey = process.env.MEMO_KEY ?? '密钥'
  const memoHex = encode(memoText, memoKey)

  // 6) [E] 组装交易对象：转账金额 + 备注 data。
  // 这是“待签名交易”参数，不是 rawTx 字节串。
  const tx = {
    to: toAddress,
    value: ethers.parseEther(process.env.TRANSFER_ETH ?? '0.001'),
    data: memoHex
  }

  console.log('Sending transaction...')
  console.log(`from: ${wallet.address}`)
  console.log(`to:   ${tx.to}`)
  console.log(`data: ${memoHex}`)

  // 7) [F]+[H] 关键一步：
  // wallet.sendTransaction(tx) 内部会自动做三件事：
  //   1) 补齐 nonce/gas/chainId
  //   2) 使用 PRIVATE_KEY 本地签名，生成 rawTx
  //   3）ethers.js 对 rawTx 做 keccak256 运算 生产txhash ⚠️ 此时交易还没广播出去 ⚠️ txHash 在本地就已经算出来了，不需要等 Infura 或链确认
  //   4) 通过 provider 调 RPC: eth_sendRawTransaction(rawTx) 发给 Infura
  //   然后返回 sentTx，其中 sentTx.hash 就是 Infura 返回的 txHash。
  const sentTx = await wallet.sendTransaction(tx)
  console.log(`txHash: ${sentTx.hash}`)

  // 8) [G] 等待链上确认并打印回执信息。
  // 这一步通常是轮询 RPC 查询交易是否被区块打包。
  const receipt = await sentTx.wait()
  console.log(`status: ${receipt?.status}`)
  console.log(`block:  ${receipt?.blockNumber}`)
}

// 统一错误出口，保证脚本失败时进程返回非 0。
main().catch(err => {
  console.error(err)
  process.exit(1)
})
