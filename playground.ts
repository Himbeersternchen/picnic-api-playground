import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import dotenv from "dotenv";

dotenv.config();

import PicnicClient from "./src/index";

const ENV_PATH = path.resolve(__dirname, ".env");

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

function saveAuthKey(key: string) {
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const updated = current.includes("PICNIC_AUTH_KEY=")
    ? current.replace(/PICNIC_AUTH_KEY=.*/, `PICNIC_AUTH_KEY=${key}`)
    : current + `\nPICNIC_AUTH_KEY=${key}\n`;
  fs.writeFileSync(ENV_PATH, updated);
  console.log("Auth key saved to .env\n");
}

async function authenticate(): Promise<string> {
  if (process.env.PICNIC_AUTH_KEY) {
    console.log("Using existing auth key from .env\n");
    return process.env.PICNIC_AUTH_KEY;
  }

  const client = new PicnicClient({ countryCode: "DE" });

  const email = await prompt("Picnic email: ");
  const password = await prompt("Picnic password: ");

  console.log("Logging in...");
  await client.auth.login(email, password);

  console.log("Requesting 2FA code via SMS...");
  await client.auth.generate2FACode("SMS");

  const code = await prompt("Enter 2FA code from SMS: ");
  const result = await client.auth.verify2FACode(code);

  saveAuthKey(result.authKey);
  return result.authKey;
}

async function main() {
  const authKey = await authenticate();
  const client = new PicnicClient({ countryCode: "DE", authKey });

  // User details
  const user = await client.user.getUserDetails();
  console.log(`Logged in as: ${user.firstname} ${user.lastname} (${user.contact_email})`);
  console.log(`Address: ${user.address.street} ${user.address.house_number}, ${user.address.city}\n`);

  // Search the catalog
  const query = "Milch";
  const items = await client.catalog.search(query);
  console.log(`Search "${query}": ${items.length} results`);
  items.slice(0, 10).forEach((item) => console.log(` - ${item.name} (${item.id})`));
  console.log();

  // Current cart
  const cart = await client.cart.getCart();
  console.log(`Cart: ${cart.total_count} items, total €${(cart.total_price / 100).toFixed(2)}`);
  cart.items.forEach((line) =>
    line.items.forEach((article) => console.log(` - ${article.name} x${article.max_count}`))
  );
}

main().catch(console.error);
