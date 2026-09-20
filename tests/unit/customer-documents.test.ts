import { describe, expect, it } from "vitest";

import { customerDocumentDownloadFilename } from "@/lib/customer-accounts/documents";

describe("customer document download names", () => {
  it("removes controls and header-significant characters from an uploaded filename", () => {
    expect(
      customerDocumentDownloadFilename('CSF 2026\r\nX-Test: value "final".pdf')
    ).toBe("CSF-2026-X-Test-value-final-.pdf");
  });

  it("uses a safe fallback when there is no usable name", () => {
    expect(customerDocumentDownloadFilename("\u0000\u0001")).toBe("constancia-fiscal");
  });
});
