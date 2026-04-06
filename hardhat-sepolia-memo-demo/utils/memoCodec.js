const MAGIC_HEADER = "0x6d656d6f";
// memoCodec 映射:
// 步骤1：文本 -> UTF-8 字节
// 步骤2：字节与 key 做 XOR 混淆
// 步骤3：转十六进制并拼接 magic header
// 步骤4：decode 时反向执行以上步骤

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex payload length");
  }

  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("Invalid hex payload content");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function normalizeKeyBytes(key) {
  if (typeof key === "number") {
    if (!Number.isInteger(key) || key < 0 || key > 255) {
      throw new Error("Numeric key must be an integer between 0 and 255");
    }
    return new Uint8Array([key]);
  }

  if (typeof key === "string") {
    const encodedKey = new TextEncoder().encode(key);
    if (encodedKey.length === 0) {
      throw new Error("Key string must not be empty");
    }
    return encodedKey;
  }

  if (key instanceof Uint8Array) {
    if (key.length === 0) {
      throw new Error("Key bytes must not be empty");
    }
    return key;
  }

  throw new Error("Key must be a number, string, or Uint8Array");
}

function xorWithKey(bytes, key) {
  const keyBytes = normalizeKeyBytes(key);
  const output = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    output[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return output;
}

export function encode(text, key) {
  // 步骤1：文本转 UTF-8 字节
  const input = new TextEncoder().encode(text);
  // 步骤2：按 key 进行 XOR 混淆
  const encoded = xorWithKey(input, key);
  // 步骤3：组装最终上链 data: header + hex payload
  return `${MAGIC_HEADER}${bytesToHex(encoded)}`;
}

export function decode(hex, key) {
  if (!hex.startsWith(MAGIC_HEADER)) {
    throw new Error("Invalid memo magic header");
  }

  // 步骤4：去掉 header -> hex 还原字节 -> XOR 还原 -> UTF-8 转文本
  const payload = hex.slice(MAGIC_HEADER.length);
  const bytes = hexToBytes(payload);
  const decoded = xorWithKey(bytes, key);
  return new TextDecoder().decode(decoded);
}

export { MAGIC_HEADER };
