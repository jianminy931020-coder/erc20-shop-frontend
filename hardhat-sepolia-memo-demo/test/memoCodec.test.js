import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decode, encode, MAGIC_HEADER } from "../utils/memoCodec.js";

describe("memoCodec", function () {
  it("encode -> decode should recover the original text", function () {
    const key = "密钥";
    const text = "hello sepolia memo 你好";

    const encoded = encode(text, key);
    const decoded = decode(encoded, key);

    assert.equal(decoded, text);
  });

  it("decoding with a different key should not recover original text", function () {
    const text = "hardhat memo test";
    const encoded = encode(text, "right-key");
    const decodedWithWrongKey = decode(encoded, "wrong-key");

    assert.notEqual(decodedWithWrongKey, text);
  });

  it("encoded text should contain the correct magic header", function () {
    const encoded = encode("memo", 9);

    assert.equal(encoded.startsWith(MAGIC_HEADER), true);
    assert.equal(encoded.slice(0, MAGIC_HEADER.length), "0x6d656d6f");
  });
});
