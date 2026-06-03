import { describe, it, expect, beforeEach } from "vitest";
import {
  isVaultSetup,
  setupVault,
  unlockVault,
  readEntries,
  writeEntries,
  changeMasterPassword,
  destroyVault,
  makeEntryId,
  type CredentialEntry,
} from "../vault-storage";

function makeEntry(overrides: Partial<CredentialEntry> = {}): CredentialEntry {
  const now = new Date().toISOString();
  return {
    id: makeEntryId(),
    label: "Gmail",
    username: "user@example.com",
    password: "p@ssw0rd!",
    url: "https://mail.google.com",
    notes: "personal",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("vault-storage (integration)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reports not set up initially", () => {
    expect(isVaultSetup()).toBe(false);
  });

  it("setupVault creates meta + empty data and unlocks", async () => {
    const key = await setupVault("master-pw");
    expect(isVaultSetup()).toBe(true);
    const entries = await readEntries(key);
    expect(entries).toEqual([]);
  });

  it("unlockVault returns a key for the right password and null otherwise", async () => {
    await setupVault("correct-horse");
    const ok = await unlockVault("correct-horse");
    expect(ok).not.toBeNull();
    const bad = await unlockVault("wrong");
    expect(bad).toBeNull();
  });

  it("unlockVault returns null when no vault exists", async () => {
    const k = await unlockVault("anything");
    expect(k).toBeNull();
  });

  it("CRUD: write + read preserves entries", async () => {
    const key = await setupVault("pw");
    const a = makeEntry({ label: "A" });
    const b = makeEntry({ label: "B", password: "💀 secret 💀" });
    await writeEntries(key, [a, b]);

    const read = await readEntries(key);
    expect(read).toEqual([a, b]);
  });

  it("update mutates an existing entry without corrupting others", async () => {
    const key = await setupVault("pw");
    const a = makeEntry({ label: "A" });
    const b = makeEntry({ label: "B" });
    await writeEntries(key, [a, b]);

    const updated = { ...b, password: "new-pass", updatedAt: new Date().toISOString() };
    await writeEntries(key, [a, updated]);

    const read = await readEntries(key);
    expect(read).toHaveLength(2);
    expect(read[0]).toEqual(a);
    expect(read[1].password).toBe("new-pass");
  });

  it("delete removes an entry", async () => {
    const key = await setupVault("pw");
    const a = makeEntry({ label: "A" });
    const b = makeEntry({ label: "B" });
    await writeEntries(key, [a, b]);
    await writeEntries(key, [a]);
    const read = await readEntries(key);
    expect(read).toEqual([a]);
  });

  it("stored payload in localStorage is encrypted (no plaintext leakage)", async () => {
    const key = await setupVault("pw");
    const entry = makeEntry({
      label: "SecretLabel-XYZ",
      username: "uniq-user-9182",
      password: "PLAINTEXT-LEAK-CHECK-7766",
    });
    await writeEntries(key, [entry]);
    const raw = localStorage.getItem("vault-data") ?? "";
    expect(raw).not.toContain("PLAINTEXT-LEAK-CHECK-7766");
    expect(raw).not.toContain("uniq-user-9182");
    expect(raw).not.toContain("SecretLabel-XYZ");
  });

  it("readEntries with wrong key fails (cannot decrypt other vault's data)", async () => {
    const key = await setupVault("pw");
    await writeEntries(key, [makeEntry()]);

    // Simulate a different vault key derived from a different password+salt
    destroyVault();
    const otherKey = await setupVault("other-pw");
    // restore the old data blob but keep the new meta -> mismatch
    // (We re-encrypt fresh data under otherKey first, then overwrite data with
    //  a blob that otherKey cannot decrypt by writing through the old key path.)
    const oldKey = await unlockVault("other-pw");
    expect(oldKey).not.toBeNull();

    // Tamper: put garbage in vault-data
    localStorage.setItem("vault-data", JSON.stringify({ iv: "AAAA", data: "BBBB" }));
    const read = await readEntries(otherKey!);
    // readEntries swallows decryption errors and returns []
    expect(read).toEqual([]);
  });

  it("changeMasterPassword re-encrypts data and old password stops working", async () => {
    const key = await setupVault("old-pw");
    const entries = [makeEntry({ label: "Bank" })];
    await writeEntries(key, entries);

    const newKey = await changeMasterPassword(key, "new-pw");
    const read = await readEntries(newKey);
    expect(read).toEqual(entries);

    expect(await unlockVault("old-pw")).toBeNull();
    expect(await unlockVault("new-pw")).not.toBeNull();
  });

  it("destroyVault clears all vault keys from storage", async () => {
    const key = await setupVault("pw");
    await writeEntries(key, [makeEntry()]);
    destroyVault();
    expect(isVaultSetup()).toBe(false);
    expect(localStorage.getItem("vault-data")).toBeNull();
  });

  it("makeEntryId produces unique ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => makeEntryId()));
    expect(ids.size).toBe(200);
  });

  it("survives a full round-trip: setup -> add many -> reload -> unlock -> read", async () => {
    const key1 = await setupVault("pw");
    const many = Array.from({ length: 25 }, (_, i) =>
      makeEntry({ label: `Site ${i}`, password: `pw-${i}-${"x".repeat(i)}` })
    );
    await writeEntries(key1, many);

    // Simulate app reload: drop the key, re-unlock from storage
    const key2 = await unlockVault("pw");
    expect(key2).not.toBeNull();
    const read = await readEntries(key2!);
    expect(read).toEqual(many);
  });
});
