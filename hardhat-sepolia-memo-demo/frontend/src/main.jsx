import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";

import "./index.css";
import App from "./App.jsx";

const subgraphUrl = import.meta.env.VITE_SUBGRAPH_URL;

const apolloClient = new ApolloClient({
  // 显式传入 HttpLink，避免在某些环境下仅使用 `uri` 简写导致 Apollo 初始化报错。
  // 若未配置 VITE_SUBGRAPH_URL，使用 invalid 域名占位，页面不会崩溃，查询处会给出配置提示。
  link: new HttpLink({ uri: subgraphUrl || "https://example.invalid/graphql" }),
  cache: new InMemoryCache(),
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <App />
    </ApolloProvider>
  </StrictMode>
);
