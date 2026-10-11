import { config } from "dotenv";
import { resolve } from "node:path";
// Both src/common and dist/common are four levels below the repository root.
config({ path: resolve(__dirname, "../../../../.env"), quiet: true });
