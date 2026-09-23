import { hashPassword } from "../packages/contracts/src/auth.ts";

const password = process.env.PRINTCAST_ADMIN_PASSWORD ?? "";
const username = process.env.PRINTCAST_ADMIN_USERNAME ?? "admin";
if (password.length < 12) {
  console.error("Set PRINTCAST_ADMIN_PASSWORD to at least 12 characters.");
  process.exit(1);
}
console.log(`ADMIN_USERNAME=${username}`);
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
console.log("Add these to the env file. Do not commit that file.");
