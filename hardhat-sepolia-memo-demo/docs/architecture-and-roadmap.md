# Hardhat Sepolia Memo Demo - 架构设计 & 开发路线

> 需求: 使用 Hardhat 开发数据上链应用，完成 MetaMask 钱包调用、交易签名、ethers.js 链上数据读取，RPC 使用 Infura，部署在 Sepolia 测试网，支持带加密备注的转账。

---

## 技术栈总览

| 层级 | Version 1 | Version 2 |
|------|-----------|-----------|
| 开发工具 | Hardhat | Hardhat |
| 钱包 | MetaMask + ethers.js | MetaMask + ethers.js |
| RPC | Infura (Sepolia) | Infura (Sepolia) |
| 链上数据 | TX data 字段 (hex 备注) | 合约 Event 日志 |
| 数据查询 | ethers.js 直接读取 | The Graph + GraphQL |
| 合约 | 无 | 自定义 Solidity 合约 |

---

## 核心角色职责

```
ethers.js   → 填单员 + 查档员（构造交易、广播、读链上数据）
MetaMask    → 你的私章（只负责签名，保管私钥）
Infura      → 门口的快递站（RPC节点，负责发送和转发）
memoCodec   → 你的密码本（备注加密/解密）
Sepolia     → 公开账本（最终存数据的地方）
```

**关键边界:**

| 模块 | 唯一职责 | 不负责的事 |
|------|---------|-----------|
| **ethers.js** | 构造交易对象、广播、读链上数据 | 不碰私钥、不签名 |
| **MetaMask** | 持有私钥、ECDSA 签名 | 不构造交易、不读数据 |
| **Infura** | RPC 节点、转发交易到 P2P 网络 | 不签名、不存应用数据 |
| **memoCodec** | 备注的编码/解码 | 和链交互无关 |

---

## Version 1 架构 - 纯转账 + 备注上链

### 写数据流（转账 + 备注上链）

```
┌─────────────────────────────────────────────┐
│  用户                                        │
│  输入: 收款地址 / 金额 / 备注文字               │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  memoCodec.js  【密码本】                    │
│                                             │
│  "生日快乐" → UTF-8 转字节 → XOR混淆          │
│           → "0xmemo_61626364..."            │
│                                             │
│  加 magic header 方便后续识别是否是备注交易     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  ethers.js  【填单员】                        │
│                                             │
│  构造标准交易对象:                             │
│  {                                          │
│    to:       "0xABC...",                    │
│    value:    parseEther("0.01"),            │
│    data:     "0xmemo_61626364...",  ← 备注  │
│    gasLimit: 21000 + data字节数 × 68        │
│  }                                          │
│                                             │
│  ⚠️ 只填单，碰不到私钥                        │
└──────────────────┬──────────────────────────┘
                   │ 把填好的单子递给 MetaMask
                   ▼
┌─────────────────────────────────────────────┐
│  MetaMask  【私章 / 保险柜】                  │
│                                             │
│  1. 弹窗展示交易详情，用户确认                 │
│  2. 用私钥做 ECDSA 签名                      │
│  3. 输出: 已签名的 rawTx                     │
│                                             │
│  ⚠️ 私钥永远不离开 MetaMask                  │
│  ⚠️ ethers.js 只能拿到签名结果，看不到私钥     │
└──────────────────┬──────────────────────────┘
                   │ 已签名 rawTx
                   ▼
┌─────────────────────────────────────────────┐
│  ethers.js  【快递员】                        │
│                                             │
│  调用 eth_sendRawTransaction                 │
│  把 rawTx 发给 Infura                        │
└──────────────────┬──────────────────────────┘
                   │ HTTPS JSON-RPC
                   ▼
┌─────────────────────────────────────────────┐
│  Infura  【快递站】                           │
│                                             │
│  接收 rawTx → 广播到 Sepolia P2P 网络         │
│  返回 txHash 给前端                           │
│                                             │
│  ⚠️ 不关心数据内容，只负责投递                 │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Sepolia 区块链  【公开账本】                  │
│                                             │
│  永久记录:                                   │
│  from:  0xYOU...                            │
│  to:    0xABC...                            │
│  value: 0.01 ETH                            │
│  data:  0xmemo_61626364...  ← 加密备注       │
└─────────────────────────────────────────────┘
```

### 读数据流（查询备注）

```
┌─────────────────────────────────────────────┐
│  用户输入 txHash 查询                         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  ethers.js  【查档员】                        │
│                                             │
│  provider.getTransaction(txHash)            │
│  直连 Infura，不需要 MetaMask                 │
│  拿到 TX 完整数据，取出 data 字段              │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  memoCodec.js  【密码本】                    │
│                                             │
│  检查 magic header → 确认是备注交易            │
│  "0xmemo_61626364..." → XOR还原              │
│                       → "生日快乐"           │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
                显示给用户
```

---

## Version 2 架构 - 合约 + The Graph

### 新增角色

```
MemoStorage.sol  → 合约（链上规则书）
The Graph        → 自动归档员（监听并索引合约事件）
GraphQL          → 查档窗口（快速查历史记录）
Apollo Client    → 前端查档工具
```

### 写数据流（调用合约）

```
用户填写信息
   │
   ▼
ethers.js  【填单员】
   将备注 + 金额 + 地址封装成合约调用:
   contract.sendWithMemo(to, memo, {value: ...})
   │
   ▼
MetaMask  【私章】
   签名 → 返回 rawTx
   │
   ▼
ethers.js  【快递员】
   广播 rawTx
   │
   ▼
Infura  【快递站】
   投递到 Sepolia
   │
   ▼
MemoStorage.sol  【合约 / 规则书】
   执行转账逻辑
   触发事件日志:
   emit MemoStored(from, to, amount, memo, timestamp)
   │
   ▼
Sepolia 区块链  【公开账本】
   交易 + Event 日志永久存储
```

### 读数据流（The Graph 查历史）

```
Sepolia 区块链
   │  持续产生新区块和 Event 日志
   │
   ▼
The Graph  【自动归档员】
   实时监听 MemoStored 事件
   解析日志 → 结构化存入数据库
   提供 GraphQL 查询接口
   │
   ▼
Apollo Client  【查档工具】
   前端发起 GraphQL 查询:
   "查 0xYOU 地址的所有备注记录"
   │
   ▼
返回结构化数据列表
   [{ from, to, amount, memo, timestamp }, ...]
   │
   ▼
渲染到页面
```

### V1 vs V2 核心区别

| 维度 | V1 | V2 |
|------|----|----|
| 读数据 | ethers.js 逐条查 | The Graph 批量索引 |
| 查历史 | 遍历所有TX（慢） | GraphQL 直接查（快） |
| 数据结构 | TX.data 自由格式 | 合约 Event 强类型 |
| 备注加密 | memoCodec 自定义 | 明文存合约（可选加密） |
| 部署复杂度 | 低（无合约） | 高（合约+子图） |

---

## txHash 详解

### txHash 是什么

```
txHash = keccak256(签名后的rawTx)
本质上就是对整笔交易内容做一次哈希运算
内容不变，哈希就不变 → 全网唯一标识这笔交易
```

### 生命周期

```
MetaMask 签名
      │
      │  生成 rawTx
      ▼
ethers.js 计算 keccak256(rawTx)
      │
      │  txHash 诞生 ← 这里产生（本地计算，还没广播）
      │
      ├──► 立刻返回给前端显示
      │
      ▼
ethers.js 广播 rawTx 到 Infura
      │
      ▼
Infura 返回同一个 txHash（确认已收到）
      │
      ▼
Sepolia 打包上链
      │
      ▼
用 txHash 查备注 / 查状态 / 去 Etherscan 浏览
```

### 唯一性保障（三重保障）

**保障一: nonce 保证同一地址不重复**

```
你的地址每发一笔交易，nonce 自动 +1
0x你的地址 第1笔: nonce=0
0x你的地址 第2笔: nonce=1
0x你的地址 第3笔: nonce=2

同一个地址，nonce 不可能重复
→ rawTx 内容不可能完全相同
→ keccak256 结果不可能相同
```

**保障二: 签名 v,r,s 保证唯一**

```
ECDSA 签名过程内部有一个随机数 k
每次签名，k 不同
→ 即使交易内容完全一样，签名结果也不同
→ rawTx 不同 → txHash 不同
```

**保障三: keccak256 碰撞概率极低**

```
输出是 256 位 = 2^256 种可能 ≈ 10^77 种
全宇宙原子数量约 10^80
找到两个相同 txHash 的概率约等于随机指定宇宙中某个原子并找到它
```

### 链上验证流程

```
节点收到一笔交易:
1. 拿到 rawTx
2. 自己计算 keccak256(rawTx) = txHash
3. 检查 txHash 是否已存在链上 → 存在则拒绝（防重放）
4. 验证 nonce 是否正确 → 必须 = 上一笔 nonce + 1
5. 验证签名 v,r,s → 从签名还原 from 地址，必须一致
6. 全部通过 → 打包入块 → txHash 成为永久索引
```

---

## 项目目录结构

```
hardhat-sepolia-memo-demo/
│
├── contracts/
│   └── MemoStorage.sol          # V2 合约
│
├── scripts/
│   ├── deploy.js                # 部署合约到 Sepolia
│   └── transfer.js              # V1 命令行测试转账
│
├── test/
│   └── MemoStorage.test.js      # 合约单测
│
├── frontend/
│   ├── src/
│   │   ├── utils/
│   │   │   └── memoCodec.js     # 备注加密/解密
│   │   ├── hooks/
│   │   │   ├── useWallet.js     # MetaMask 连接
│   │   │   └── useGraph.js      # GraphQL 查询
│   │   └── App.jsx
│   └── package.json
│
├── subgraph/                    # V2 The Graph 子图
│   ├── schema.graphql           # 数据结构定义
│   ├── subgraph.yaml            # 监听合约配置
│   └── src/mapping.ts           # Event → 数据库映射
│
├── hardhat.config.js
└── .env                         # INFURA_KEY / PRIVATE_KEY
```

---

## 从 0 到 1 开发路线

### 阶段一: 环境准备

```
1. 注册 Infura → 创建项目 → 拿到 API Key → 开启 Sepolia
2. MetaMask 浏览器插件 → 创建测试钱包 → 切换 Sepolia 网络
3. 领测试币 → sepoliafaucet.com 或 Infura 水龙头
4. 验证: node v18+, 钱包有 Sepolia ETH, Infura endpoint 能通
```

### 阶段二: 初始化项目

```
1. mkdir hardhat-sepolia-memo-demo && cd hardhat-sepolia-memo-demo
2. npm init -y
3. npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
4. npm install ethers dotenv
5. npx hardhat init → 选 JavaScript project
6. 创建 .env → INFURA_KEY + PRIVATE_KEY
7. 配置 hardhat.config.js → sepolia 网络指向 Infura RPC
8. 验证: npx hardhat console --network sepolia 能连上
```

### 阶段三: 编写 memoCodec 编解码工具

```
1. 创建 utils/memoCodec.js
2. 实现 encode(text, key):
   text → TextEncoder → Uint8Array → XOR key → hex + magic header
3. 实现 decode(hex, key):
   去掉 header → hex → Uint8Array → XOR key → TextDecoder → 原文
4. 编写单测 test/memoCodec.test.js
5. 运行: npx hardhat test test/memoCodec.test.js
```

### 阶段四: 命令行跑通 V1 转账 + 备注

```
1. 创建 scripts/transfer.js
2. 流程:
   a. 加载 .env
   b. 创建 JsonRpcProvider 连接 Infura
   c. 创建 Wallet(私钥, provider)
   d. memoCodec.encode("备注", "密钥")
   e. 构造 tx 对象 {to, value, data}
   f. wallet.sendTransaction(tx)
   g. 等待 receipt = await tx.wait()
   h. 打印 txHash
3. 运行: npx hardhat run scripts/transfer.js --network sepolia
4. 验证: 去 sepolia.etherscan.io 搜 txHash，查看 Input Data
```

### 阶段五: 命令行跑通读取 + 解码

```
1. 创建 scripts/readMemo.js
2. 流程:
   a. 创建 provider（只读，不需要私钥）
   b. provider.getTransaction(txHash)
   c. 取出 tx.data
   d. memoCodec.decode(tx.data, "密钥")
   e. 打印还原后的备注原文
3. 验证: 打印 === 阶段四发送的原文 → V1 核心闭环完成 ✅
```

### 阶段六: 前端搭建 + MetaMask 接入

```
1. npm create vite@latest frontend -- --template react
2. cd frontend && npm install ethers
3. 实现 hooks/useWallet.js
   - 检查 window.ethereum
   - eth_requestAccounts 授权
   - BrowserProvider → getSigner
4. 实现发送页面: 表单 → encode → sendTransaction → MetaMask弹窗
5. 实现查询页面: txHash输入 → getTransaction → decode → 展示
6. 测试: 发送 → 确认 → 拿txHash → 查询解码
   V1 全流程完成 ✅
```

### 阶段七: 编写 MemoStorage 合约 (V2)

```
1. 创建 contracts/MemoStorage.sol
   - sendWithMemo() 函数
   - MemoStored event
2. 编写单测 test/MemoStorage.test.js
3. 运行: npx hardhat test
```

### 阶段八: 部署合约到 Sepolia

```
1. 创建 scripts/deploy.js
2. 部署: npx hardhat run scripts/deploy.js --network sepolia
3. 记录合约地址
4. 可选: npx hardhat verify --network sepolia 合约地址
```

### 阶段九: 前端对接合约

```
1. 复制合约 ABI 到前端
2. 修改发送逻辑 → contract.sendWithMemo()
3. 修改读取逻辑 → 通过合约 event 查询
```

### 阶段十: 搭建 The Graph 子图

```
1. npm install -g @graphprotocol/graph-cli
2. graph init --from-contract 合约地址 --network sepolia
3. 编写 schema.graphql → MemoRecord entity
4. 编写 mapping.ts → handleMemoStored
5. 部署到 Subgraph Studio
6. 在 Playground 验证 GraphQL 查询
```

### 阶段十一: 前端接入 GraphQL

```
1. npm install @apollo/client graphql
2. 配置 Apollo Provider → 指向子图 endpoint
3. 替换读取逻辑 → GraphQL 批量查历史
4. 实现历史记录列表页
5. 测试: 发送 → 子图索引 → 刷新列表
   V2 全流程完成 ✅
```

---

## 里程碑检查清单

- [ ] 阶段二 — Hardhat 能连上 Sepolia
- [ ] 阶段三 — encode/decode 单测通过
- [ ] 阶段五 — 命令行能发+读备注 (V1 核心闭环)
- [ ] 阶段六 — 前端 MetaMask 发+查 (V1 完整交付)
- [ ] 阶段八 — 合约部署到 Sepolia
- [ ] 阶段十 — 子图能索引 event
- [ ] 阶段十一 — 前端 GraphQL 查历史 (V2 完整交付)
