import { describe, it, expect } from "vitest";
import {
  deriveKey,
  encryptJson,
  decryptJson,
  newSalt,
  saltToB64,
  saltFromB64,
} from "../vault-crypto";

describe("vault-crypto", () => {
  it("generates a 16-byte salt", () => {
    const salt = newSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(16);
  });

  it("round-trips salt through base64", () => {
    const salt = newSalt();
    const restored = saltFromB64(saltToB64(salt));
    expect(Array.from(restored)).toEqual(Array.from(salt));
  });

  it("derives a deterministic key for same password+salt", async () => {
    const salt = newSalt();
    const k1 = await deriveKey("hunter2", salt);
    const k2 = await deriveKey("hunter2", salt);
    const payload = { hello: "world" };
    const blob = await encryptJson(k1, payload);
    const out = await decryptJson<typeof payload>(k2, blob);
    expect(out).toEqual(payload);
  });

  it("encrypt + decrypt round-trips arbitrary JSON", async () => {
    const key = await deriveKey("pw", newSalt());
    const payload = {
      list: [1, 2, 3],
      arabic: "مرحبا بالعالم",
      nested: { a: true, b: null, c: "x" },
    };
    const blob = await encryptJson(key, payload);
    expect(blob.iv).toBeTruthy();
    expect(blob.data).toBeTruthy();
    const out = await decryptJson(key, blob);
    expect(out).toEqual(payload);
  });

  it("produces different ciphertext for identical plaintext (random IV)", async () => {
    const key = await deriveKey("pw", newSalt());
    const a = await encryptJson(key, { x: 1 });
    const b = await encryptJson(key, { x: 1 });
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it("fails to decrypt with wrong password", async () => {
    const salt = newSalt();
    const good = await deriveKey("right", salt);
    const bad = await deriveKey("wrong", salt);
    const blob = await encryptJson(good, { secret: 42 });
    await expect(decryptJson(bad, blob)).rejects.toBeDefined();
  });

  it("fails to decrypt when ciphertext is tampered", async () => {
    const key = await deriveKey("pw", newSalt());
    const blob = await encryptJson(key, { secret: 42 });
    // Flip a byte in the base64 data
    const tampered = {
      iv: blob.iv,
      data: blob.data.slice(0, -2) + (blob.data.endsWith("A") ? "B=" : "A="),
    };
    await expect(decryptJson(key, tampered)).rejects.toBeDefined();
  });

  it("fails to decrypt with wrong IV", async () => {
    const key = await deriveKey("pw", newSalt());
    const blob = await encryptJson(key, { secret: 42 });
    const wrongIv = await encryptJson(key, { other: 1 });
    await expect(
      decryptJson(key, { iv: wrongIv.iv, data: blob.data })
    ).rejects.toBeDefined();
  });
});
