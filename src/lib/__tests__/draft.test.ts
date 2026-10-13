import { describe, expect, it } from "vitest";
import { applyDraft } from "../draft";
import type { FormField } from "../types";

const f = (over: Partial<FormField>): FormField => ({ key: "k", label: "Q", type: "textarea", required: true, value: "", source: "empty", ...over });
const opts = (...l: string[]) => l.map((x) => ({ label: x, value: x }));

describe("applyDraft", () => {
  it("fills empty text answers and keeps Claude's note", () => {
    const [out] = applyDraft([f({})], [{ key: "k", value: " I like it. ", note: "Check the dates" }]);
    expect(out).toMatchObject({ value: "I like it.", source: "ai", note: "Check the dates" });
  });
  it("never overwrites your answers or profile answers", () => {
    const fields = [f({ key: "a", value: "mine", source: "you" }), f({ key: "b", value: "p", source: "profile" })];
    expect(applyDraft(fields, [{ key: "a", value: "x", note: "" }, { key: "b", value: "y", note: "" }])).toEqual(fields);
  });
  it("only accepts choices the form offers, ignoring case", () => {
    const [ok] = applyDraft([f({ type: "select", options: opts("Yes", "No") })], [{ key: "k", value: "yes", note: "" }]);
    expect(ok.value).toBe("Yes");
    const [bad] = applyDraft([f({ type: "select", options: opts("Yes", "No") })], [{ key: "k", value: "Maybe", note: "" }]);
    expect(bad).toMatchObject({ value: "", source: "empty" });
  });
  it("drops a multi-choice answer if any part is invalid", () => {
    const field = f({ type: "multiselect", options: opts("Product", "Infra", "AI") });
    expect(applyDraft([field], [{ key: "k", value: "Product\nAI", note: "" }])[0].value).toBe("Product\nAI");
    expect(applyDraft([field], [{ key: "k", value: "Product\nBlockchain", note: "" }])[0].value).toBe("");
  });
  it("leaves a question empty when Claude couldn't answer it truthfully", () => {
    const [out] = applyDraft([f({})], [{ key: "k", value: "", note: "Your CV doesn't mention a security clearance." }]);
    expect(out).toMatchObject({ value: "", source: "empty", note: "Your CV doesn't mention a security clearance." });
  });
});
