const required = [22, 13, 0];
const current = process.versions.node.split(".").map(Number);

const supported = current.some((part, index) => {
  if (part === required[index]) return false;
  return part > required[index] && required.slice(0, index).every((requiredPart, earlier) => current[earlier] === requiredPart);
}) || current.every((part, index) => part === required[index]);

if (!supported) {
  console.error([
    `BIS requires Node.js 22.13.0 or newer; this process is using ${process.versions.node}.`,
    "Activate the repository runtime with `nvm use` (or install it with `nvm install`) and retry.",
  ].join("\n"));
  process.exit(1);
}
