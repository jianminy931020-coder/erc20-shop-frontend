// React Hook: 用于创建带缓存能力的回调函数、以及组件状态。
import { useCallback, useEffect, useState } from "react";
// ethers: 用于连接浏览器钱包并处理地址/余额格式。
import { ethers } from "ethers";

function pickInjectedProvider() {
  const injected = window.ethereum;
  if (!injected) {
    return null;
  }

  if (Array.isArray(injected.providers) && injected.providers.length > 0) {
    return injected.providers.find((p) => p.isMetaMask) ?? injected.providers[0];
  }

  return injected;
}

// 自定义 Hook：统一管理钱包连接、账户信息和余额刷新。
export function useWallet() {
  /*
    核心理解（provider vs signer）:
    provider = ethers.js 的 BrowserProvider 对象（封装了 MetaMask 注入的 window.ethereum）。
               职责是“看链”为主（查余额、查交易、查区块）。
    signer   = ethers.js 的 JsonRpcSigner 对象（由 BrowserProvider.getSigner() 产出）。
               它代表“当前 MetaMask 授权账户”执行签名/发交易。
    私钥归属  = 始终在 MetaMask 内部保管，ethers.js 不会读取到私钥明文。

    钱包连接映射:
    步骤1：检查 window.ethereum 是否存在
    步骤2：请求账户授权 eth_requestAccounts
    步骤3：构造 BrowserProvider
    步骤4：provider.getSigner() 获取 signer（对象是 ethers.js 的，密钥由 MetaMask 管）
    步骤5：保存地址和余额到 state
  */

  // provider: ethers.js 的 BrowserProvider（底层接的是 MetaMask 的 window.ethereum）。
  const [provider, setProvider] = useState(null);
  // signer: ethers.js 的 JsonRpcSigner（代表 MetaMask 当前账户做签名/发交易）。
  const [signer, setSigner] = useState(null);
  // address: 当前连接账户地址（0x...）。
  const [address, setAddress] = useState("");
  // balance: 当前地址 ETH 余额（字符串，单位 ETH）。
  const [balance, setBalance] = useState("0");
  // isConnecting: UI 上“连接中”按钮状态。
  const [isConnecting, setIsConnecting] = useState(false);
  // error: 最近一次钱包连接或读取失败的错误信息。
  const [error, setError] = useState("");

  const syncConnectedAccount = useCallback(async (injectedProvider) => {
    const nextProvider = new ethers.BrowserProvider(injectedProvider);
    const nextSigner = await nextProvider.getSigner();
    const nextAddress = await nextSigner.getAddress();
    const nextBalance = await nextProvider.getBalance(nextAddress);

    setProvider(nextProvider);
    setSigner(nextSigner);
    setAddress(nextAddress);
    setBalance(ethers.formatEther(nextBalance));
  }, []);

  const clearWalletState = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress("");
    setBalance("0");
  }, []);

  // connectWallet: 触发钱包授权并同步账户信息。
  const connectWallet = useCallback(async () => {
    // 步骤1：先检查浏览器是否注入以太坊对象（MetaMask 会注入 window.ethereum）。
    const injectedProvider = pickInjectedProvider();
    if (!injectedProvider) {
      // 未安装钱包时直接提示并返回。
      setError("未检测到 MetaMask，请先安装浏览器插件钱包。");
      return;
    }

    // 标记为“连接中”，用于禁用按钮和提示用户等待。
    setIsConnecting(true);
    // 每次重试连接前先清空旧错误，避免 UI 残留历史报错。
    setError("");

    try {
      // 步骤2：请求钱包弹窗授权账户访问。
      await injectedProvider.request({ method: "eth_requestAccounts" });
      // 步骤3~5：创建 BrowserProvider + signer，并同步地址/余额。
      await syncConnectedAccount(injectedProvider);
    } catch (err) {
      // 兜底错误处理：优先展示钱包/RPC 的原始错误信息。
      setError(err?.message ?? "连接钱包失败");
    } finally {
      // 无论成功失败都结束“连接中”状态，防止按钮卡死。
      setIsConnecting(false);
    }
  }, [syncConnectedAccount]);

  useEffect(() => {
    const injectedProvider = pickInjectedProvider();
    if (!injectedProvider) {
      return;
    }

    let cancelled = false;

    const hydrateConnection = async () => {
      try {
        const accounts = await injectedProvider.request({ method: "eth_accounts" });
        if (!cancelled && Array.isArray(accounts) && accounts.length > 0) {
          await syncConnectedAccount(injectedProvider);
        } else if (!cancelled) {
          clearWalletState();
        }
      } catch {
        if (!cancelled) {
          clearWalletState();
        }
      }
    };

    const handleAccountsChanged = (accounts) => {
      if (!Array.isArray(accounts) || accounts.length === 0) {
        clearWalletState();
        return;
      }

      syncConnectedAccount(injectedProvider).catch((err) => {
        setError(err?.message ?? "同步钱包状态失败");
      });
    };

    const handleDisconnect = () => {
      clearWalletState();
    };

    hydrateConnection();
    injectedProvider.on?.("accountsChanged", handleAccountsChanged);
    injectedProvider.on?.("disconnect", handleDisconnect);

    return () => {
      cancelled = true;
      injectedProvider.removeListener?.("accountsChanged", handleAccountsChanged);
      injectedProvider.removeListener?.("disconnect", handleDisconnect);
    };
  }, [clearWalletState, syncConnectedAccount]);

  // refreshBalance: 在交易确认后主动刷新余额显示。
  const refreshBalance = useCallback(async () => {
    // 若 provider 或 address 未就绪，则跳过刷新。
    if (!provider || !address) {
      return;
    }

    // 读取最新地址余额（wei）。
    const nextBalance = await provider.getBalance(address);
    // 转换为 ETH 字符串并写回状态。
    setBalance(ethers.formatEther(nextBalance));
  }, [address, provider]);

  // 返回 Hook 暴露给页面层的全部状态与动作。
  return {
    // provider: 只读链上查询能力。
    provider,
    // signer: 交易签名与发送能力。
    signer,
    // address: 当前账户地址。
    address,
    // balance: 当前账户余额（ETH）。
    balance,
    // isConnecting: 连接流程 loading 状态。
    isConnecting,
    // error: 连接错误信息。
    error,
    // connectWallet: 发起钱包连接。
    connectWallet,
    // refreshBalance: 主动刷新余额。
    refreshBalance,
  };
}
