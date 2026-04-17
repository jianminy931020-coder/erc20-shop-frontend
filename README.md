# erc20-shop-frontend

## 目录结构

```text
erc20-shop-frontend/
├── src/
│   ├── abis/
│   │   ├── ProductStore.json     # 从 artifacts 提取的合约 ABI
│   │   └── ERC20.json            # 标准 ERC20 ABI（approve/allowance/balanceOf）
│   ├── config/
│   │   ├── wagmi.ts              # Wagmi + RainbowKit 初始化配置
│   │   └── contracts.ts          # 合约地址常量 + USDT_DECIMALS
│   ├── hooks/
│   │   ├── useProducts.ts        # getAllProducts() → 商品列表
│   │   ├── useAllowance.ts       # allowance(user, shop) → 授权额度
│   │   ├── useApprove.ts         # approve(shop, price) → 授权交易
│   │   ├── useBuyProduct.ts      # buyProduct(id) → 购买交易
│   │   ├── useUserPurchases.ts   # getUserPurchasedProducts() → 已购列表
│   │   └── useUsdtBalance.ts     # balanceOf(user) → USDT 余额
│   ├    ── useOwner.ts          ← 读合约 owner()，对比当前钱包地址
│   ├    ── useAddProduct.ts     ← addProduct(name, imageUrl, priceUSDT)
│   └    ── useToggleProduct.ts  ← toggleProduct(productId) 上/下架
│
│   ├── components/
│   │   ├── Header.tsx            # 顶栏：Logo + USDT余额 + 连接钱包
│   │   ├── ProductList.tsx       # 商品网格列表（含骨架屏）
│   │   ├── ProductCard.tsx       # 单个商品卡片：图片/名称/价格
│   │   ├── BuyButton.tsx         # 核心交互：Approve → Buy 状态机
│   │   └── PurchasedList.tsx     # 已购商品展示区
        └── AdminPanel.tsx        # Owner 专属管理面板
│   ├── App.tsx                   # 页面组装 + refetch 信号传递
│   ├── main.tsx                  # Provider 注入入口
│   └── index.css                 # Tailwind 入口
├── vite.config.ts                # Vite + @tailwindcss/vite 插件
└── package.json
```

## 技术架构

```text
┌─────────────────────────────────────────────────────────────┐
│                    erc20-shop-frontend                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  main.tsx  (Provider 层)                            │    │
│  │  WagmiProvider → QueryClientProvider → RainbowKit  │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐    │
│  │  App.tsx  (页面层)                                   │    │
│  │  Header + ProductList + PurchasedList               │    │
│  └──────┬──────────────────────┬────────────────────────┘    │
│         │                     │                             │
│  ┌──────▼──────┐      ┌───────▼────────┐                    │
│  │  ProductList│      │  PurchasedList │                    │
│  │  └ProductCard│      │  useUserPurchases│                  │
│  │    └BuyButton│      └────────────────┘                   │
│  └─────────────┘                                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Hooks 层（链上读写封装）                             │    │
│  │                                                     │    │
│  │  读取 (useReadContract)                              │    │
│  │  ├── useProducts       → getAllProducts()           │    │
│  │  ├── useAllowance      → allowance()                │    │
│  │  ├── useUserPurchases  → getUserPurchasedProducts() │    │
│  │  └── useUsdtBalance    → balanceOf()                │    │
│  │                                                     │    │
│  │  写入 (useWriteContract + useWaitForTxReceipt)       │    │
│  │  ├── useApprove        → approve()                  │    │
│  │  └── useBuyProduct     → buyProduct()               │    │
│  └──────────────────────────┬──────────────────────────┘    │
│                             │                               │
│  ┌──────────────────────────▼──────────────────────────┐    │
│  │  Wagmi v2 + Viem  →  Sepolia RPC                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  BuyButton 状态机:                                           │
│  未连接 → [连接钱包]                                          │
│  allowance < price → [授权 X USDT] ──approve tx──▶          │
│  allowance >= price → [购买 X USDT] ──buy tx──▶             │
│  已购买 → [✓ 已购买] disabled                                │
│                                                             │
│  技术栈: Vite + React 18 + TypeScript                        │
│          Wagmi v2 + Viem + RainbowKit + Tailwind CSS        │
└─────────────────────────────────────────────────────────────┘
```
流程
Vite 初始化
    ↓
安装 Web3 依赖（wagmi / viem / rainbowkit）
    ↓
配置 wagmi（网络 + 钱包）          ← 依赖上一步的包
    ↓
main.tsx 注入 Provider             ← 依赖 wagmi 配置
    ↓
准备 ABI + 合约地址常量             ← 依赖已部署的合约
    ↓
封装 Hooks（读 / 写）               ← 依赖 ABI + 地址
    ↓
BuyButton 状态机                   ← 依赖所有 hooks
    ↓
组件拼装成页面                      ← 依赖所有组件

技术栈
层	选型
构建工具	Vite + TypeScript
UI 框架	React 18
Web3	Wagmi v2 + Viem
钱包连接	RainbowKit
样式	Tailwind CSS
状态管理	Wagmi hooks 自带（无需额外引入）

UI 层
└── RainbowKit
    └── 提供连接钱包按钮、弹窗、钱包选择界面

React Web3 层
└── wagmi
    └── 提供 useAccount / useReadContract / useWriteContract 等 hooks react风格api

异步状态层
└── TanStack Query
    └── 提供缓存、loading、refetch、查询生命周期管理，这类“写操作成功后，相关读数据刷新”的模式，正是 Query 擅长管理的场景。如果完全不用 TanStack Query，你就得自己写很多 useState + useEffect：



底层链工具层
└── viem
    └── 提供链交互底层能力、数据格式化、编码解码

tailwind 用“插件方式引入”，而 wagmi、RainbowKit、TanStack Query 不需要，是因为它们作用的层次完全不一样

tailwind 本质上是“构建工具链的一部分”。它不是单纯在运行时给你一个 JS 函数，而是要在开发和打包阶段参与 CSS 处理，扫描你的类名、生成最终样式、接入 Vite 的构建流程。所以你会在 vite.config.ts 里看到它作为 Vite 插件接进去。这一步是告诉 Vite：“编译前端时，顺便让 Tailwind 参与处理样式”。

而 wagmi、RainbowKit、TanStack Query 是“应用运行时库”，不是构建插件。它们主要解决的是页面跑起来之后的事情：

wagmi 负责区块链连接和合约交互。
它提供 useAccount、useReadContract、useWriteContract 这些 React hooks，让你在组件里读钱包、读合约、发交易。
RainbowKit 负责钱包连接 UI。
它建立在 wagmi 之上，提供 ConnectButton、连接弹窗、钱包选择这些现成界面。
TanStack Query 负责数据请求状态和缓存。
wagmi 自己很多查询能力其实就是基于它来管理 loading / success / refetch / cache 的，所以你要在根组件里包一个 QueryClientProvider。
所以可以把它们理解成两组：

构建层
Tailwind + @tailwindcss/vite
作用：编译 CSS、扫描类名、产出样式
接入位置：vite.config.ts

运行层
wagmi
RainbowKit
TanStack Query
作用：页面运行时的钱包连接、链上读写、数据缓存
接入位置：main.tsx

viem vs etherjs 主要区别是什么
1. API 风格不同
ethers.js 更偏“类 + 实例”的写法。

你常会看到：它比较像传统 SDK
const provider = new ethers.JsonRpcProvider(rpcUrl)
const contract = new ethers.Contract(address, abi, provider)
const balance = await contract.balanceOf(user)
viem 更偏“函数式 + 显式配置”的写法。

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
})

const balance = await publicClient.readContract({
  address,
  abi,
  functionName: 'balanceOf',
  args: [user],
})
它不是通过 new Contract() 挂一堆方法，而是更明确地说：

我有一个 client
我现在要执行一个 readContract 动作
这种风格通常更利于类型推断，也更适合组合式编程。
2. TypeScript 体验不同
viem 的一个很大卖点就是 TypeScript 类型体验更强、更严格。

比如你给错了：

合约参数类型
地址格式
返回值处理方式
viem 更倾向于在编译阶段就帮你拦住。

它大量使用像 `0x${string}` 这样的类型约束，这在 DApp 里很有用。

ethers.js 也支持 TypeScript，但整体风格没那么“类型优先”。

3. 数据处理思路不同
ethers.js 以前常有自己的 BigNumber 体系，虽然 v6 更现代了，但很多历史项目里你会看到大量 BigNumber 代码。

viem 更直接拥抱原生 bigint。

这点你在你项目里就能看到，比如：

price: bigint
productId: bigint
allowance >= price
这种写法很简洁，也更接近现代 TS/JS 的数值处理方式。

4. 与 wagmi 的关系更紧密
现代版本的 wagmi 底层就是基于 viem 设计的，所以两者配合会特别顺。

也就是说：

wagmi 不是“顺便兼容 viem”
而是“本来就建立在 viem 思路之上”

wagmi 经常用 viem 作为底层能力
但 viem 本身不依赖 wagmi

viem 可以独立存在
wagmi 常常依赖 viem 思路和能力
React 不是 viem 的必需条件


你项目里 Provider 在做什么
在 main.tsx 里这三层：

WagmiProvider：提供钱包/链上下文（账户、读写合约能力）
QueryClientProvider：提供查询缓存上下文（loading、缓存、refetch）
RainbowKitProvider：提供钱包连接 UI 上下文（ConnectButton 等）
它们把“全局能力”注入给整个 App 子树，下面组件不用层层传 props。

三者关系（你一直问的核心）

CounterContext（类比）= 通道ID/锁芯（由 createContext 创建）
Provider = 往这个通道ID里放 value
useContext(同一个Context对象) = 在子组件读取最近一层 Provider 的 value
重点是“同一个 Context 对象引用”必须一致，不是看变量名字符串。

为什么 Provider 有顺序
因为是嵌套作用域，里层可能依赖外层上下文。
你这套顺序保证了 Web3 相关 hook 和钱包 UI 都能拿到前置上下文；顺序错了会出现“缺上下文”报错。

内部实现本质
React Context 机制就三步：

createContext(defaultValue) 创建上下文对象
<Context.Provider value={...}> 在子树注入值
useContext(Context) 在后代组件读取最近 Provider 的值
children 只是被包裹渲染的组件树；真正传递的是 Provider 的 value，不是通过 props 一层层手传。

一句话收尾
Provider 是“全局能力注入器”，Context 是“通道标识”，useContext 是“读取器”。你项目的 wagmi/rainbowkit/query 都是在用这套机制。