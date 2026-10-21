import { importErrorMessage } from "@/lib/import-error";

it("identifies firewall HTML instead of blaming columns", () => {
  expect(importErrorMessage({ response: { status: 403, data: "<html>Forbidden</html>" } }, "Invalid columns")).toContain("AWS WAF");
});
it("preserves application validation and permission details", () => {
  expect(importErrorMessage({ response: { status: 400, data: { message: ["Missing UID", "Invalid email"] } } }, "Failed")).toBe("Missing UID; Invalid email");
  expect(importErrorMessage({ response: { status: 403, data: { message: "Admin only" } } }, "Failed")).toBe("Admin only");
});
it.each([413, 502, 503, 504])("explains upstream HTTP %i failures", status => {
  expect(importErrorMessage({ response: { status, data: "HTML" } }, "Invalid columns")).not.toBe("Invalid columns");
});
