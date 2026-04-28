import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";

export function isInteractive(): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

export async function promptText(
  message: string,
  defaultValue?: string,
): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const suffix = defaultValue ? ` [${defaultValue}]` : "";
    const answer = await new Promise<string>((resolve) => {
      rl.question(`${message}${suffix}: `, resolve);
    });
    const trimmed = answer.trim();
    return trimmed.length > 0 ? trimmed : (defaultValue ?? "");
  } finally {
    rl.close();
  }
}

const CR = 0x0d;
const LF = 0x0a;
const ETX = 0x03; // Ctrl-C
const EOT = 0x04; // Ctrl-D
const BS = 0x08;  // Backspace
const DEL = 0x7f; // ASCII DEL (also produced by macOS Backspace key)

/**
 * Read a line from stdin without echoing characters. Falls back to plain
 * readline when raw mode isn't available (e.g. stdin is piped from a file).
 */
export async function promptHidden(message: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      stdout.write(message);
      const value = await new Promise<string>((resolve) => {
        rl.question("", resolve);
      });
      return value.trim();
    } finally {
      rl.close();
    }
  }

  return new Promise<string>((resolve) => {
    stdout.write(message);
    stdin.setRawMode!(true);
    stdin.resume();
    let buf = "";
    const cleanup = () => {
      stdin.setRawMode?.(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };
    const onData = (data: Buffer) => {
      for (const code of data) {
        if (code === CR || code === LF || code === EOT) {
          cleanup();
          stdout.write("\n");
          resolve(buf.trim());
          return;
        }
        if (code === ETX) {
          cleanup();
          stdout.write("\n");
          process.exit(130);
        }
        if (code === BS || code === DEL) {
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        // Visible characters only (skip other control bytes).
        if (code >= 0x20 && code !== 0x7f) {
          buf += String.fromCharCode(code);
          stdout.write("*");
        }
      }
    };
    stdin.on("data", onData);
  });
}

export async function promptYesNo(
  message: string,
  defaultYes = false,
): Promise<boolean> {
  const suffix = defaultYes ? " [Y/n]" : " [y/N]";
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(`${message}${suffix} `, (a) => resolve(a.trim().toLowerCase()));
    });
    if (!answer) return defaultYes;
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

export function maskSecret(s: string): string {
  if (s.length <= 8) return "*".repeat(s.length);
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}
