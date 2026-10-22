// Copies the built plugin into a vault's plugins folder.
// Usage: npm run install-plugin -- "C:\path\to\vault"   (or set OBSIDIAN_VAULT)
import fs from 'node:fs';
import path from 'node:path';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const vault = process.argv[2] ?? process.env.OBSIDIAN_VAULT;

if (!vault) {
	console.error('No vault given. Pass a vault path or set OBSIDIAN_VAULT.');
	process.exit(1);
}
if (!fs.existsSync(path.join(vault, '.obsidian'))) {
	console.error(`"${vault}" is not an Obsidian vault (no .obsidian folder).`);
	process.exit(1);
}
if (!fs.existsSync('main.js')) {
	console.error('main.js not found. Run "npm run build" first.');
	process.exit(1);
}

const dest = path.join(vault, '.obsidian', 'plugins', manifest.id);
fs.mkdirSync(dest, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
	fs.copyFileSync(file, path.join(dest, file));
}
// Lets the Hot-Reload community plugin pick up rebuilds automatically.
fs.writeFileSync(path.join(dest, '.hotreload'), '');

console.log(`Installed ${manifest.name} ${manifest.version} to ${dest}`);
