import { describe, expect, it } from "vitest";
import { MediaAssetType } from "@prisma/client";

import {
  parseCloudinaryUrl,
  resolveAssetVisibility,
  validateUploadConstraints,
} from "../src/lib/cloudinary";

describe("cloudinary helpers", () => {
  it("parses CLOUDINARY_URL credentials", () => {
    const parsed = parseCloudinaryUrl(
      "cloudinary://12345:secret-token@demo-cloud",
    );

    expect(parsed.cloudName).toBe("demo-cloud");
    expect(parsed.apiKey).toBe("12345");
    expect(parsed.apiSecret).toBe("secret-token");
  });

  it("marks kyc assets as private visibility", () => {
    expect(resolveAssetVisibility(MediaAssetType.GSTIN_DOC)).toBe("PRIVATE");
    expect(resolveAssetVisibility(MediaAssetType.PROPERTY_IMAGE)).toBe("PUBLIC");
  });

  it("validates upload mime and size constraints", () => {
    expect(() =>
      validateUploadConstraints({
        assetType: MediaAssetType.PROPERTY_IMAGE,
        mimeType: "image/jpeg",
        bytes: 1024,
      }),
    ).not.toThrow();

    expect(() =>
      validateUploadConstraints({
        assetType: MediaAssetType.GSTIN_DOC,
        mimeType: "text/plain",
        bytes: 1024,
      }),
    ).toThrow();
  });
});
