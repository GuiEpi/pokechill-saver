import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
    modules: ["@wxt-dev/module-react"],
    manifest: {
        name: "pokechill-saver",
        description: "Auto-save pokechill game data to Dropbox",
        permissions: ["storage", "identity", "activeTab"],
        host_permissions: ["https://play-pokechill.github.io/*"],
        browser_specific_settings: {
            gecko: {
                id: "pokechill-saver@extension",
            },
        },
    },
    hooks: {
        "build:manifestGenerated": (_wxt, manifest) => {
            if (manifest.browser_specific_settings?.gecko) {
                (manifest.browser_specific_settings.gecko as Record<string, unknown>).data_collection_permissions = {
                    required: ["none"],
                    optional: [],
                };
            }
        },
    },
});
