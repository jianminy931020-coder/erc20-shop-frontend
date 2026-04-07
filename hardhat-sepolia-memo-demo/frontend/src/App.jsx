import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

import { useWallet } from "./hooks/useWallet";
import memoStorageArtifact from "../../artifacts/contracts/MemoStorage.sol/MemoStorage.json";
import { decode, encode } from "../../utils/memoCodec.js";
import "./App.css";

const SEPOLIA_CHAIN_ID = 11155111n;
// 重要背景：
// 我们最初尝试过“EOA 普通转账 + data 备注”（signer.sendTransaction({ to, value, data }))。
// 但部分钱包会拒绝该模式并报错：
// "External transactions to internal accounts cannot include data"
// 因此这里改为“调用合约 sendWithMemo”来承载备注数据，确保钱包兼容性更好。

// GraphQL 查询：按地址查「发送记录 + 接收记录」，稍后前端合并去重并按时间倒序。
const MEMO_HISTORY_QUERY = gql`
  query MemoHistoryByAddress($address: Bytes!, $first: Int!) {
    sent: memoRecords(
      first: $first
      where: { from: $address }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      from
      to
      amount
      memo
      timestamp
    }
    received: memoRecords(
      first: $first
      where: { to: $address }
      orderBy: timestamp
      orderDirection: desc
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

function formatSendError(err) {
  return err?.message ?? "发送失败";
}

const USDT_APPROVE_ABI = [
  // 最小 ABI：只声明 approve，避免引入完整 ERC20 ABI。
  "function approve(address spender, uint256 amount) external returns (bool)",
];

function App() {
  /*
    provider / signer 分工：
    signer = ethers.js 的签名器对象（JsonRpcSigner），由 MetaMask 授权账户驱动；
             发交易时会唤起 MetaMask 弹窗确认，私钥始终留在钱包内。
    readProvider = ethers.js 的 JsonRpcProvider（Infura 只读 RPC）；
                   仅用于链上读取，不参与签名。

    当前版本链路（V2，合约 + 子图 + 保留 memoCodec）：
    步骤1 用户输入: 收款地址 / 金额 / 备注（密钥来自前端环境变量）
    步骤2 本地 encode: encode(备注, 密钥)
    步骤3 合约发送: contract.sendWithMemo(to, encodedMemo, { value })
    步骤4 MetaMask 签名并广播
    步骤5 子图索引 MemoStored 事件
    步骤6 GraphQL 一次查询该地址历史记录
    步骤7 本地 decode(event.memo, 密钥)

    V1 保留说明（注释保留，不删除）：
    1) 发送: 构造签名 和发起交易， signer.sendTransaction({ to, value, data: encodedMemo })
        构造签名
           补齐 nonce / gas / chainId / fee 等字段
           用 signer 对交易签名（得到 rawTx）
        广播到节点
            调 RPC eth_sendRawTransaction(rawTx) 发给 Infura/节点
            返回 sentTx（包含 hash）
    2) 读取曾使用: provider.getTransaction(txHash) -> tx.data -> decode(tx.data, key)
    3) 由于 EOA + data 在部分钱包被拒绝，发送改为合约 sendWithMemo
    4) 由于历史查询性能问题，读取改为 Subgraph GraphQL 聚合查询

  */

  // 从 useWallet 获取钱包状态与连接/刷新动作。
  const {
    signer,
    address,
    balance,
    isConnecting,
    error: walletError,
    connectWallet,
    refreshBalance,
  } = useWallet();

  const [activeTab, setActiveTab] = useState("send");
  // 新增：发送资产模式切换（ETH / USDT）。
  const [sendAssetMode, setSendAssetMode] = useState("eth");

  // 发送页输入状态：用户填写的业务参数。
  const [sendForm, setSendForm] = useState({
    to: "",
    amount: "0.001",
    memoText: "备注",
  });
  // 发送流程状态：loading / 文案 / txHash。
  const [sendState, setSendState] = useState({ loading: false, message: "", txHash: "" });
  // 新增：USDT 发送流程状态，和 ETH 状态隔离，避免互相覆盖。
  const [usdtSendState, setUsdtSendState] = useState({ loading: false, message: "", txHash: "" });
  // 新增：USDT 表单数据，和 ETH 表单隔离。
  const [usdtSendForm, setUsdtSendForm] = useState({
    to: "",
    // 默认 1 USDT。
    amount: "1",
    memoText: "备注",
  });

  // 查询页输入状态：按地址查询（不是 txHash）。
  const [queryAddress, setQueryAddress] = useState("");

  // 仅允许前端读取 VITE_ 前缀环境变量。
  const memoStorageAddress = import.meta.env.VITE_MEMO_STORAGE_ADDRESS;
  const memoKey = import.meta.env.VITE_MEMO_KEY;
  const subgraphUrl = import.meta.env.VITE_SUBGRAPH_URL;
  // 新增：USDT 合约地址（从前端环境变量读取）。
  const usdtAddress = import.meta.env.VITE_USDT_ADDRESS;

  // 直接复用 Hardhat 产物里的 ABI，不手抄接口。
  const memoStorageAbi = memoStorageArtifact.abi;

  // 钱包连接后，若查询地址为空则自动填入当前钱包地址。
  useEffect(() => {
    if (!queryAddress && address) {
      setQueryAddress(address);
    }
  }, [address, queryAddress]);

  // GraphQL 变量：地址转小写，和 subgraph Bytes 字段对齐更稳。
  const normalizedQueryAddress = queryAddress.trim().toLowerCase();

  // 对比（改造前）：
  // A. provider.getTransaction(txHash) 读取 tx.data，再 decode(tx.data, key)。
  // B. ethers.js 拿到回执结果 逐条扫 logs / 前端自己解析事件。
  // 对比（改造后）：
  // 现在用 GraphQL 一次拿到历史列表（快），再在前端做 decode 和排序展示。
  const {
    data: historyData,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery(MEMO_HISTORY_QUERY, {
    variables: { address: normalizedQueryAddress, first: 100 },
    skip: !subgraphUrl || !ethers.isAddress(normalizedQueryAddress),
    fetchPolicy: "network-only",
  });

  const historyRecords = useMemo(() => {
    const sent = historyData?.sent ?? [];
    const received = historyData?.received ?? [];

    // 合并并按 id 去重（同一笔可能同时命中 from/to）。
    const byId = new Map();
    [...sent, ...received].forEach((item) => {
      byId.set(item.id, item);
    });

    // 时间倒序展示最新记录。
    return Array.from(byId.values())
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
      .map((item) => {
        let decodedMemo = "";

        try {
          decodedMemo = memoKey ? decode(item.memo, memoKey) : "(缺少 VITE_MEMO_KEY，无法解码)";
        } catch {
          decodedMemo = "(解码失败，密钥可能不匹配)";
        }

        return {
          ...item,
          decodedMemo,
          amountEth: ethers.formatEther(item.amount),
          timeText: new Date(Number(item.timestamp) * 1000).toLocaleString(),
        };
      });
  }, [historyData, memoKey]);

  const handleSendInputChange = (event) => {
    const { name, value } = event.target;
    setSendForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUsdtSendInputChange = (event) => {
    // 新增：更新 USDT 表单字段。
    const { name, value } = event.target;
    setUsdtSendForm((prev) => ({ ...prev, [name]: value }));
  };

  // 合约版发送：contract.sendWithMemo(to, memo, { value })
  // 说明：这是对“EOA + data 备注被钱包拦截”问题的规避方案。
  const handleSend = async (event) => {
    // 阻止表单默认刷新页面行为。
    event.preventDefault();

    // 没有 signer 代表还未连接钱包或未授权。
    if (!signer) {
      setSendState({ loading: false, message: "请先连接 MetaMask 钱包", txHash: "" });
      return;
    }

    // 合约地址缺失会导致 contract 实例无法创建。
    if (!memoStorageAddress || !ethers.isAddress(memoStorageAddress)) {
      setSendState({
        loading: false,
        message: "缺少 VITE_MEMO_STORAGE_ADDRESS 或地址格式错误",
        txHash: "",
      });
      return;
    }

    try {
      // 进入发送中状态，提示用户即将看到钱包确认弹窗。
      setSendState({ loading: true, message: "正在发起交易，请在 MetaMask 确认...", txHash: "" });

      // 网络保护：只允许在 Sepolia 上发送。
      const network = await signer.provider.getNetwork();
      if (network.chainId !== SEPOLIA_CHAIN_ID) {
        throw new Error("请先把 MetaMask 网络切换到 Sepolia");
      }

      // 地址格式校验。
      if (!ethers.isAddress(sendForm.to)) {
        throw new Error("收款地址格式不正确");
      }

      if (!memoKey) {
        throw new Error("缺少 VITE_MEMO_KEY，请在 frontend/.env.local 配置后重试");
      }

      // 保留原逻辑：备注先本地编码，再写入合约 event。
      // 对比（改造前）：
      // 之前是直接转账 + data：signer.sendTransaction({ to, value, data: encodedMemo })
      // 现在改为合约调用，仍保留本地 encode 逻辑。
      const encodedMemo = encode(sendForm.memoText, memoKey);
      // signer 绑定的 contract：用于发起需要签名的写操作。
      const contract = new ethers.Contract(memoStorageAddress, memoStorageAbi, signer);
      // 对比（改造后）：
      // 合约版发送：contract.sendWithMemo(to, encodedMemo, { value })
      // 合约调用：金额作为 payable value，备注作为参数写入事件。
      const tx = await contract.sendWithMemo(sendForm.to, encodedMemo, {
        value: ethers.parseEther(sendForm.amount),
      });

      // 广播成功后拿到 txHash。
      setSendState({
        loading: true,
        message: "交易已广播，等待链上确认...",
        txHash: tx.hash,
      });

      // 等待链上确认。
      const receipt = await tx.wait();
      // 确认后刷新余额。
      await refreshBalance();

      // 发新交易后主动刷新历史列表（子图索引后会显示）。
      refetchHistory().catch(() => {
        // 子图可能尚未同步到新块，这里静默即可。
      });

      // 根据 receipt.status 给出成功/失败提示。
      setSendState({
        loading: false,
        message: receipt?.status === 1 ? "交易确认成功（可稍后在历史列表查看）" : "交易已上链但状态失败",
        txHash: tx.hash,
      });
    } catch (err) {
      // 兜底异常（拒签、RPC、参数、合约 revert）。
      setSendState({ loading: false, message: formatSendError(err), txHash: "" });
    }
  };

  const handleSendUsdt = async (event) => {
    // 阻止表单默认刷新。
    event.preventDefault();

    // 必须先连接 MetaMask。
    if (!signer) {
      setUsdtSendState({ loading: false, message: "请先连接 MetaMask 钱包", txHash: "" });
      return;
    }

    // MemoStorage 合约地址校验。
    if (!memoStorageAddress || !ethers.isAddress(memoStorageAddress)) {
      setUsdtSendState({
        loading: false,
        message: "缺少 VITE_MEMO_STORAGE_ADDRESS 或地址格式错误",
        txHash: "",
      });
      return;
    }

    // USDT 合约地址校验。
    if (!usdtAddress || !ethers.isAddress(usdtAddress)) {
      setUsdtSendState({
        loading: false,
        message: "缺少 VITE_USDT_ADDRESS 或地址格式错误",
        txHash: "",
      });
      return;
    }

    try {
      // 仅允许在 Sepolia 执行，避免误发主网。
      const network = await signer.provider.getNetwork();
      if (network.chainId !== SEPOLIA_CHAIN_ID) {
        throw new Error("请先把 MetaMask 网络切换到 Sepolia");
      }

      // 收款地址格式校验。
      if (!ethers.isAddress(usdtSendForm.to)) {
        throw new Error("收款地址格式不正确");
      }

      // 备注密钥校验（encode 需要）。
      if (!memoKey) {
        throw new Error("缺少 VITE_MEMO_KEY，请在 frontend/.env.local 配置后重试");
      }

      // USDT 使用 6 位精度：例如 1.5 -> 1500000。
      const parsedAmount = ethers.parseUnits(usdtSendForm.amount, 6);
      // 备注按现有逻辑先 encode，再上链。
      const encodedMemo = encode(usdtSendForm.memoText, memoKey);

      // 第 1 步：先授权 MemoStorage 可扣这笔 USDT。
      setUsdtSendState({
        loading: true,
        message: "步骤1/2：授权 USDT，请在 MetaMask 确认...",
        txHash: "",
      });

      // 构造 USDT 合约实例（仅 approve 能力）。
      const usdtContract = new ethers.Contract(usdtAddress, USDT_APPROVE_ABI, signer);
      // 发送授权交易。发送一笔交易到 USDT 合约，设置授权额度给 memoStorageAddress
      const approveTx = await usdtContract.approve(memoStorageAddress, parsedAmount);
      // 等待授权交易确认。
      await approveTx.wait();

      // 第 2 步：调用 MemoStorage 的 sendUSDTWithMemo 执行转账并写备注事件。
      setUsdtSendState({
        loading: true,
        message: "步骤2/2：发送备注交易，请在 MetaMask 确认...",
        txHash: "",
      });

      // 构造 MemoStorage 合约实例。
      const contract = new ethers.Contract(memoStorageAddress, memoStorageAbi, signer);
      // 发起 USDT + memo 交易（链上会 emit MemoStored）。
      const sendTx = await contract.sendUSDTWithMemo(
        //u合约地址
        usdtAddress,
        //收款人
        usdtSendForm.to,
        //金额
        parsedAmount,
        //备注
        encodedMemo
      );

      // 广播后先展示 txHash。
      setUsdtSendState({
        loading: true,
        message: "USDT 备注交易已广播，等待链上确认...",
        txHash: sendTx.hash,
      });

      // 等待交易确认。
      const receipt = await sendTx.wait();
      // 刷新钱包 ETH 余额（gas 消耗会变化）。
      await refreshBalance();
      // 刷新历史记录列表（subgraph 索引可能有延迟）。
      refetchHistory().catch(() => {});

      // 根据回执状态反馈最终结果。
      setUsdtSendState({
        loading: false,
        message:
          receipt?.status === 1 ? "USDT 备注交易确认成功（可稍后在历史列表查看）" : "交易已上链但状态失败",
        txHash: sendTx.hash,
      });
    } catch (err) {
      setUsdtSendState({ loading: false, message: formatSendError(err), txHash: "" });
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sepolia Memo Demo</p>
          <h1>备注转账 + 链上解码</h1>
        </div>

        <button className="btn primary" onClick={connectWallet} disabled={isConnecting}>
          {isConnecting ? "连接中..." : address ? "已连接钱包" : "连接 MetaMask"}
        </button>
      </header>

      <section className="wallet-card">
        <p>
          <strong>钱包地址:</strong> {address || "未连接"}
        </p>
        <p>
          <strong>余额:</strong> {Number(balance).toFixed(6)} ETH
        </p>
        <p>
          <strong>合约地址:</strong> {memoStorageAddress || "未配置"}
        </p>
        <p>
          <strong>Subgraph:</strong> {subgraphUrl || "未配置"}
        </p>
        {walletError ? <p className="error">{walletError}</p> : null}
      </section>

      <nav className="tabs">
        <button
          className={activeTab === "send" ? "tab active" : "tab"}
          onClick={() => setActiveTab("send")}
        >
          发送模式
        </button>
        <button
          className={activeTab === "query" ? "tab active" : "tab"}
          onClick={() => setActiveTab("query")}
        >
          历史记录
        </button>
      </nav>

      {activeTab === "send" ? (
        <section className="panel">
          <h2>步骤2：填写参数并提交合约交易</h2>
          <div className="tabs" style={{ marginTop: "0.8rem" }}>
            <button
              className={sendAssetMode === "eth" ? "tab active" : "tab"}
              // 切换到 ETH 发送表单。
              onClick={() => setSendAssetMode("eth")}
              type="button"
            >
              ETH 转账
            </button>
            <button
              className={sendAssetMode === "usdt" ? "tab active" : "tab"}
              // 切换到 USDT 发送表单。
              onClick={() => setSendAssetMode("usdt")}
              type="button"
            >
              USDT 转账
            </button>
          </div>

          {sendAssetMode === "eth" ? (
            <>
              {/* ETH 模式：完全沿用原有发送逻辑 */}
              <form className="form-grid" onSubmit={handleSend}>
                <label>
                  收款地址
                  <input name="to" value={sendForm.to} onChange={handleSendInputChange} required />
                </label>

                <label>
                  金额 (ETH)
                  <input
                    name="amount"
                    value={sendForm.amount}
                    onChange={handleSendInputChange}
                    type="number"
                    min="0"
                    step="0.0001"
                    required
                  />
                </label>

                <label>
                  备注文字
                  <textarea
                    name="memoText"
                    value={sendForm.memoText}
                    onChange={handleSendInputChange}
                    rows={3}
                    required
                  />
                </label>

                <button className="btn primary" type="submit" disabled={sendState.loading}>
                  {sendState.loading ? "处理中..." : "提交并签名"}
                </button>
              </form>

              {sendState.message ? <p className="status">{sendState.message}</p> : null}
              {sendState.txHash ? (
                <p className="hash">
                  txHash: <code>{sendState.txHash}</code>
                </p>
              ) : null}
            </>
          ) : (
            <>
              {/* USDT 模式：两笔交易（approve -> sendUSDTWithMemo） */}
              <form className="form-grid" onSubmit={handleSendUsdt}>
                <label>
                  收款地址
                  <input name="to" value={usdtSendForm.to} onChange={handleUsdtSendInputChange} required />
                </label>

                <label>
                  金额 (USDT)
                  <input
                    name="amount"
                    value={usdtSendForm.amount}
                    onChange={handleUsdtSendInputChange}
                    type="number"
                    min="0"
                    // 6 位小数精度输入步长（匹配 parseUnits(..., 6)）。
                    step="0.000001"
                    required
                  />
                </label>

                <label>
                  备注文字
                  <textarea
                    name="memoText"
                    value={usdtSendForm.memoText}
                    onChange={handleUsdtSendInputChange}
                    rows={3}
                    required
                  />
                </label>

                <button className="btn primary" type="submit" disabled={usdtSendState.loading}>
                  {usdtSendState.loading ? "处理中..." : "提交并签名"}
                </button>
              </form>

              {usdtSendState.message ? <p className="status">{usdtSendState.message}</p> : null}
              {usdtSendState.txHash ? (
                <p className="hash">
                  txHash: <code>{usdtSendState.txHash}</code>
                </p>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <section className="panel">
          <h2>步骤2：按地址查询历史备注（GraphQL）</h2>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              refetchHistory().catch(() => {});
            }}
          >
            <label>
              查询地址
              <input
                name="queryAddress"
                value={queryAddress}
                onChange={(event) => setQueryAddress(event.target.value)}
                placeholder="0x..."
                required
              />
            </label>

            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button className="btn primary" type="submit" disabled={historyLoading}>
                {historyLoading ? "查询中..." : "刷新列表"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => address && setQueryAddress(address)}
                disabled={!address}
              >
                使用当前钱包地址
              </button>
            </div>
          </form>

          {!subgraphUrl ? <p className="error">缺少 VITE_SUBGRAPH_URL，请在 frontend/.env.local 配置</p> : null}
          {historyError ? <p className="error">{historyError.message}</p> : null}

          <div className="result-card" style={{ marginTop: "1rem" }}>
            <p><strong>记录数:</strong> {historyRecords.length}</p>
          </div>

          {historyRecords.map((record) => (
            <div key={record.id} className="result-card">
              <p><strong>time:</strong> {record.timeText}</p>
              <p><strong>from:</strong> {record.from}</p>
              <p><strong>to:</strong> {record.to}</p>
              <p><strong>amount:</strong> {record.amountEth} ETH</p>
              <p><strong>raw memo:</strong> <code>{record.memo}</code></p>
              <p><strong>decoded memo:</strong> {record.decodedMemo}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default App;
