import type { CodingLanguage } from "@/lib/coding-round";

export function getWrappedSource(params: {
  language: CodingLanguage;
  questionId: string;
  userCode: string;
}): { fileName: string; source: string } {
  const { language, questionId, userCode } = params;

  if (language === "javascript") {
    if (questionId === "two-sum") {
      return {
        fileName: "main.js",
        source: `
const fs = require('fs');
${userCode}

function _main() {
  const input = fs.readFileSync('/dev/stdin', 'utf-8').trim().split(/\\s+/);
  if (input.length < 3) return;
  const n = parseInt(input[0]);
  const nums = input.slice(1, n + 1).map(Number);
  const target = parseInt(input[n + 1]);
  const ans = twoSum(nums, target);
  console.log(ans.join(' '));
}
_main();
        `.trim(),
      };
    }
    if (questionId === "product-array") {
      return {
        fileName: "main.js",
        source: `
const fs = require('fs');
${userCode}

function _main() {
  const input = fs.readFileSync('/dev/stdin', 'utf-8').trim().split(/\\s+/);
  if (input.length < 2) return;
  const n = parseInt(input[0]);
  const nums = input.slice(1, n + 1).map(Number);
  const ans = productExceptSelf(nums);
  console.log(ans.join(' '));
}
_main();
        `.trim(),
      };
    }
    if (questionId === "valid-parentheses") {
      return {
        fileName: "main.js",
        source: `
const fs = require('fs');
${userCode}

function _main() {
  const s = fs.readFileSync('/dev/stdin', 'utf-8').trim();
  const ans = isValid(s);
  console.log(ans);
}
_main();
        `.trim(),
      };
    }
    if (questionId === "longest-substring") {
      return {
        fileName: "main.js",
        source: `
const fs = require('fs');
${userCode}

function _main() {
  const s = fs.readFileSync('/dev/stdin', 'utf-8').trim();
  const ans = lengthOfLongestSubstring(s);
  console.log(ans);
}
_main();
        `.trim(),
      };
    }
    if (questionId === "matrix-transpose") {
      return {
        fileName: "main.js",
        source: `
const fs = require('fs');
${userCode}

function _main() {
  const input = fs.readFileSync('/dev/stdin', 'utf-8').trim().split(/\\s+/);
  if (input.length < 2) return;
  const r = parseInt(input[0]);
  const c = parseInt(input[1]);
  let idx = 2;
  const matrix = [];
  for (let i = 0; i < r; i++) {
    const row = [];
    for (let j = 0; j < c; j++) {
      row.push(parseInt(input[idx++]));
    }
    matrix.push(row);
  }
  const ans = transpose(matrix);
  for (let i = 0; i < ans.length; i++) {
    console.log(ans[i].join(' '));
  }
}
_main();
        `.trim(),
      };
    }
  }

  if (language === "python") {
    const common = `
import sys
from typing import List, Tuple
    `.trim();
    if (questionId === "two-sum") {
      return {
        fileName: "main.py",
        source: `
${common}

${userCode}

def _main():
  data = sys.stdin.read().strip().split()
  if len(data) < 3: return
  n = int(data[0])
  nums = list(map(int, data[1:1+n]))
  target = int(data[1+n])
  ans = two_sum(nums, target)
  if isinstance(ans, str):
    print(ans.strip())
  else:
    i, j = ans
    print(f"{i} {j}")

if __name__ == "__main__":
  _main()
        `.trim(),
      };
    }
    if (questionId === "longest-substring") {
      return {
        fileName: "main.py",
        source: `
${common}

${userCode}

def _main():
  s = sys.stdin.read().strip()
  print(length_of_longest_substring(s))

if __name__ == "__main__":
  _main()
        `.trim(),
      };
    }
    if (questionId === "valid-parentheses") {
      return {
        fileName: "main.py",
        source: `
${common}

${userCode}

def _main():
  s = sys.stdin.read().strip()
  ans = is_valid(s)
  print("true" if ans else "false")

if __name__ == "__main__":
  _main()
        `.trim(),
      };
    }
    if (questionId === "matrix-transpose") {
      return {
        fileName: "main.py",
        source: `
${common}

${userCode}

def _main():
  data = sys.stdin.read().strip().split()
  if len(data) < 2: return
  r = int(data[0])
  c = int(data[1])
  idx = 2
  matrix = []
  for _ in range(r):
    row = []
    for _ in range(c):
      row.append(int(data[idx]))
      idx += 1
    matrix.append(row)
  
  ans = transpose(matrix)
  for row in ans:
    print(" ".join(map(str, row)))

if __name__ == "__main__":
  _main()
        `.trim(),
      };
    }
    if (questionId === "product-array") {
      return {
        fileName: "main.py",
        source: `
${common}

${userCode}

def _main():
  data = sys.stdin.read().strip().split()
  if len(data) < 2: return
  n = int(data[0])
  nums = list(map(int, data[1:1+n]))
  ans = product_except_self(nums)
  print(" ".join(map(str, ans)))

if __name__ == "__main__":
  _main()
        `.trim(),
      };
    }
  }

  // Fallback: treat as a full program if unknown
  return {
    fileName:
      language === "python"
        ? "main.py"
        : language === "javascript"
          ? "main.js"
          : language === "java"
            ? "Main.java"
            : language === "c"
              ? "main.c"
              : language === "sql"
                ? "main.sql"
                : "main.cpp",
    source: userCode,
  };
}
