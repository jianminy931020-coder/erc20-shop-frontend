// 导入合约事件类型：MemoStoredEvent 对应合约里的 MemoStored 事件。
import { MemoStored as MemoStoredEvent } from "../generated/MemoStorage/MemoStorage";
// 导入实体类型：MemoRecord 对应 schema.graphql 里的实体定义。
import { MemoRecord } from "../generated/schema";

// 事件处理函数：The Graph 每抓到一条 MemoStored 事件都会调用这里。
export function handleMemoStored(event: MemoStoredEvent): void {
  // 创建唯一 ID：交易哈希 + 日志索引，避免同一交易多个日志冲突。
  let entity = new MemoRecord(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );

  // 写入 from 字段（发送者地址）。
  entity.from = event.params.from;
  // 写入 to 字段（接收者地址）。
  entity.to = event.params.to;
  // 写入 amount 字段（wei）。
  entity.amount = event.params.amount;
  // 写入 memo 字段（链上事件里的备注原值）。
  entity.memo = event.params.memo;
  // 写入 timestamp 字段（链上事件里的时间戳）。
  entity.timestamp = event.params.timestamp;

  // 持久化保存到子图数据库。
  entity.save();
}
