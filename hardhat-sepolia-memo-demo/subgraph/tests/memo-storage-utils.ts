import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import { MemoStored } from "../generated/MemoStorage/MemoStorage"

export function createMemoStoredEvent(
  from: Address,
  to: Address,
  amount: BigInt,
  memo: string,
  timestamp: BigInt
): MemoStored {
  let memoStoredEvent = changetype<MemoStored>(newMockEvent())

  memoStoredEvent.parameters = new Array()

  memoStoredEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  )
  memoStoredEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  memoStoredEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  memoStoredEvent.parameters.push(
    new ethereum.EventParam("memo", ethereum.Value.fromString(memo))
  )
  memoStoredEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )

  return memoStoredEvent
}
