import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";

import "./index.css";
import App from "./App.jsx";

const subgraphUrl = import.meta.env.VITE_SUBGRAPH_URL;

const apolloClient = new ApolloClient({
  uri: subgraphUrl,
  cache: new InMemoryCache(),
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <App />
    </ApolloProvider>
  </StrictMode>
);
