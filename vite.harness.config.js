// QA-only build config. Produces a UMD bundle of src/main.ts with the
// uploader/designer SDKs swapped for local fakes (harness/fake*.js) so the
// upload-intake contact-step flow can be driven headlessly without a real
// file picker. Never used for the published package — see harness/README.md.
import { resolve, dirname } from "path";
import { defineConfig } from "vite";
import { fileURLToPath } from "url";

const _dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@printcart/uploader-sdk": resolve(_dirname, "harness/fakeUploaderSdk.js"),
      "@printcart/design-tool-sdk": resolve(
        _dirname,
        "harness/fakeDesignToolSdk.js"
      ),
    },
  },
  build: {
    outDir: "dist-harness",
    emptyOutDir: true,
    lib: {
      entry: resolve(_dirname, "src/main.ts"),
      name: "PrintcartShopify",
      formats: ["umd"],
      fileName: () => "main.js",
    },
  },
});
