# The Graph 完整指南

> The Graph 是区块链数据的索引协议，把链上 Event 日志实时同步到数据库，通过 GraphQL 提供高效查询。

---

## 为什么需要 The Graph

### 没有 The Graph

```
你想查"我发过的所有备注":

ethers.js 只能:
   从区块 0 开始 → 遍历每个区块 → 遍历每笔交易
   → 检查 from 是不是你 → 检查有没有 MemoStored event
   → 一条一条拼起来

就像去图书馆找一本书，但图书馆没有索引目录
你只能从第一排书架开始一本一本翻
Sepolia 有几百万个区块，翻到猴年马月
```

### 有了 The Graph

```
它提前帮你把所有书分类编号做好索引
你直接说"给我所有 0xYOU 发的备注"
它 0.1 秒就返回结果
```

---

## 现实类比

```
把 Sepolia 区块链想象成一个 24 小时直播的监控摄像头
每秒都在产生新画面（新区块）

The Graph = 一个不睡觉的实习生

你给实习生一张任务单（subgraph.yaml）：
"盯着这个合约地址，只要看到 MemoStored 事件
 就把 from、to、amount、memo、timestamp 抄到笔记本上"

实习生的笔记本     = 数据库（PostgreSQL）
实习生的任务单     = subgraph.yaml
实习生抄笔记的规则 = mapping.ts
笔记本的表格格式   = schema.graphql
查笔记本的窗口     = GraphQL API
```

---

## 核心角色分工

```
合约负责 "写"      → emit event 上链
The Graph 负责 "抄" → 监听 event 存数据库
GraphQL 负责 "查"   → 前端快速检索历史记录
```

---

## 三个核心文件详解

### 1. schema.graphql — 笔记本的表格格式

```graphql
type MemoRecord @entity {
  id:        ID!          # 唯一标识（通常用 txHash）
  from:      Bytes!       # 发送人地址
  to:        Bytes!       # 接收人地址
  amount:    BigInt!      # 转账金额
  memo:      String!      # 备注内容
  timestamp: BigInt!      # 时间戳
}
```

**作用:** 定义数据库表结构，The Graph 会自动帮你建好这张表。

**类比:** 相当于你给实习生发了一张空白表格模板，告诉他每行要记哪些列。

---

### 2. subgraph.yaml — 实习生的任务单

```yaml
specVersion: 0.0.5
schema:
  file: ./schema.graphql

dataSources:
  - kind: ethereum
    name: MemoStorage
    network: sepolia
    source:
      address: "0x你的合约地址"
      abi: MemoStorage
      startBlock: 12345678        # 合约部署的区块号
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - MemoRecord
      abis:
        - name: MemoStorage
          file: ./abis/MemoStorage.json
      eventHandlers:
        - event: MemoStored(indexed address,indexed address,uint256,string,uint256)
          handler: handleMemoStored
```

**作用:** 告诉 The Graph 节点:

```
盯哪条链:         sepolia
盯哪个合约:       0x你的合约地址
从哪个区块开始盯:  12345678（合约部署的区块）
盯哪些事件:       MemoStored
看到事件后干什么:  调用 mapping.ts 里的 handleMemoStored 函数
```

**类比:** 相当于任务单上写着 "从3月1日开始，盯着仓库A的门口，只要有人搬货出来，就按规则记到笔记本上"。

---

### 3. mapping.ts — 实习生抄笔记的规则

```typescript
import { MemoStored } from "../generated/MemoStorage/MemoStorage";
import { MemoRecord } from "../generated/schema";

export function handleMemoStored(event: MemoStored): void {
  // 1. 用 txHash 作为唯一 ID 创建一条新记录
  let record = new MemoRecord(event.transaction.hash.toHex());

  // 2. 从 event 参数里取出字段，填进记录
  record.from      = event.params.from;
  record.to        = event.params.to;
  record.amount    = event.params.amount;
  record.memo      = event.params.memo;
  record.timestamp = event.params.timestamp;

  // 3. 保存到数据库
  record.save();
}
```

**作用:** 每次链上触发 MemoStored event，The Graph 就自动调用这个函数，把数据抄进数据库。

**类比:** 实习生看到有人搬货出来，按规则把 谁搬的、搬给谁、搬了多少、附言是什么、什么时间 填进笔记本。

---

## 三个文件的关系

```
schema.graphql          subgraph.yaml            mapping.ts
 定义表结构               定义监听规则              定义处理逻辑
     │                       │                       │
     │   graph codegen        │                       │
     ├───────────────────────►│                       │
     │   生成 TypeScript 类型  │                       │
     │                        │                       │
     │                        │   看到 event 时        │
     │                        ├──────────────────────►│
     │                        │   调用 handler 函数    │
     │                        │                       │
     │                        │                       │  record.save()
     │◄───────────────────────┼───────────────────────┤
     │   数据按 schema 格式存入数据库                    │
```

---

## 完整数据流（一笔交易从发出到被查询）

```
Step 1  用户发起交易
        contract.sendWithMemo("0xBob", "生日快乐", {value: 0.01 ETH})
              │
              ▼
Step 2  合约执行，触发 event
        emit MemoStored(0xYou, 0xBob, 0.01ETH, "生日快乐", 1712345678)
              │
              │  event 被写入区块的 receipt logs
              ▼
Step 3  The Graph 节点发现新区块
        "检查一下这个区块里有没有我关心的 event..."
        "有！MemoStored！"
              │
              ▼
Step 4  The Graph 调用 mapping.ts
        handleMemoStored(event)
              │
              │  从 event 取出字段
              │  创建 MemoRecord
              │  保存到数据库
              ▼
Step 5  数据库里多了一行
        ┌──────────┬────────┬────────┬────────┬──────────┐
        │ id       │ from   │ to     │ amount │ memo     │
        ├──────────┼────────┼────────┼────────┼──────────┤
        │ 0xtx123  │ 0xYou  │ 0xBob  │ 0.01   │ 生日快乐 │
        └──────────┴────────┴────────┴────────┴──────────┘
              │
              │  现在任何人都可以查了
              ▼
Step 6  前端发起 GraphQL 查询
        query {
          memoRecords(where: { from: "0xYou" }) {
            to, amount, memo, timestamp
          }
        }
              │
              ▼
Step 7  The Graph 返回结果
        [{
          to: "0xBob",
          amount: "0.01",
          memo: "生日快乐",
          timestamp: "1712345678"
        }]
              │
              ▼
Step 8  前端渲染到页面
```

---

## 部署流程

### Step 1 — 注册 Subgraph Studio

```
访问 thegraph.com/studio
用 MetaMask 钱包登录
创建新子图 → 拿到 deploy key
```

### Step 2 — 本地初始化

```bash
# 安装 CLI
npm install -g @graphprotocol/graph-cli

# 初始化（自动生成模板文件）
graph init --from-contract 0x合约地址 --network sepolia
```

### Step 3 — 编写三个核心文件

```
schema.graphql  → 定义 MemoRecord entity
subgraph.yaml   → 配置合约地址、起始区块、监听事件
mapping.ts      → 编写 handleMemoStored 处理逻辑
```

### Step 4 — 生成类型

```bash
graph codegen
```

根据 schema 和 ABI 自动生成 TypeScript 类型，这样 mapping.ts 里写代码有类型提示。

### Step 5 — 编译

```bash
graph build
```

把 mapping.ts 编译成 WebAssembly (WASM)。The Graph 节点运行的是 WASM 不是 JS。

### Step 6 — 认证 + 部署

```bash
graph auth --studio 你的deploy-key
graph deploy --studio 你的子图名字
```

上传到 Subgraph Studio。

### Step 7 — 等待同步

```
Studio 开始从 startBlock 扫描历史区块
把所有历史 event 都索引一遍
然后切换到实时监听新区块模式
```

### Step 8 — 查询验证

```
在 Studio 的 Playground 里执行 GraphQL 查询
能查到之前发的交易 → 子图工作正常
拿到 API endpoint 给前端用
```

---

## 前端接入 GraphQL

### 安装

```bash
npm install @apollo/client graphql
```

### 配置 Apollo Client

```typescript
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

const client = new ApolloClient({
  uri: "https://api.studio.thegraph.com/query/你的子图ID/你的子图名/version/latest",
  cache: new InMemoryCache(),
});
```

### 查询示例

```typescript
// 查询某地址的所有备注记录
const MEMO_QUERY = gql`
  query GetMemos($address: Bytes!) {
    memoRecords(
      where: { from: $address }
      orderBy: timestamp
      orderDirection: desc
      first: 100
    ) {
      id
      from
      to
      amount
      memo
      timestamp
    }
  }
`;

// 使用
const { data } = await client.query({
  query: MEMO_QUERY,
  variables: { address: "0xYOU..." },
});
```

### React Hook 用法

```tsx
import { useQuery } from "@apollo/client";

function MemoHistory({ address }) {
  const { loading, error, data } = useQuery(MEMO_QUERY, {
    variables: { address },
  });

  if (loading) return <p>加载中...</p>;
  if (error) return <p>查询失败</p>;

  return (
    <ul>
      {data.memoRecords.map((record) => (
        <li key={record.id}>
          转给 {record.to} | {record.amount} ETH | 备注: {record.memo}
        </li>
      ))}
    </ul>
  );
}
```

---

## 常见问题

### Q: 子图同步要多久？

```
取决于 startBlock 到当前区块的距离
如果合约刚部署，几分钟就同步完
如果从很早的区块开始，可能要几小时
```

### Q: 数据实时性如何？

```
通常延迟 15-30 秒
新区块产生 → The Graph 节点扫描 → 索引入库 → 可查询
不是毫秒级实时，但对大多数场景够用
```

### Q: 子图挂了怎么办？

```
Subgraph Studio 会自动重启
如果 mapping.ts 有 bug 导致索引失败
子图会停在出错的区块，需要修复代码重新部署
```

### Q: 免费还是收费？

```
Subgraph Studio 测试网免费
主网查询量大时需要 GRT 代币付费
开发阶段完全不用担心费用
```

---

## 调试技巧

### 本地运行 Graph Node（可选）

```
项目里已有 docker-compose.yml
docker-compose up
可以在本地跑一个 Graph 节点，方便调试 mapping 逻辑
不用每次都部署到 Studio
```

### 查看索引状态

```
Studio 面板上可以看到:
- 当前同步到第几个区块
- 有没有索引错误
- 查询次数统计
```

### 常用 GraphQL 查询

```graphql
# 查最近 10 条记录
{
  memoRecords(first: 10, orderBy: timestamp, orderDirection: desc) {
    id, from, to, amount, memo, timestamp
  }
}

# 按收款人查
{
  memoRecords(where: { to: "0xBob..." }) {
    from, amount, memo, timestamp
  }
}

# 查大额转账
{
  memoRecords(where: { amount_gt: "1000000000000000000" }) {
    from, to, amount, memo
  }
}
```
