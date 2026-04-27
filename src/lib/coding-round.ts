export type CodingLanguage = "python" | "java" | "c" | "cpp" | "javascript" | "sql";

export type CodingQuestion = {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium";
  source: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  examples: Array<{ input: string; output: string; explanation: string }>;
  tests: Array<{ input: string; output: string }>;
  starterByLanguage: Partial<Record<CodingLanguage, string>>;
};

export const CODING_LANGUAGES: Array<{ id: CodingLanguage; label: string; monaco: string }> = [
  { id: "python", label: "Python", monaco: "python" },
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "java", label: "Java", monaco: "java" },
  { id: "c", label: "C", monaco: "c" },
  { id: "cpp", label: "C++", monaco: "cpp" },
  { id: "sql", label: "SQL (SQLite)", monaco: "sql" },
];

const BACKEND_QUESTIONS: CodingQuestion[] = [
  {
    id: "two-sum",
    title: "Two Sum (LeetCode style)",
    difficulty: "Medium",
    source: "LeetCode Inspired",
    description:
      "Given an integer array nums and an integer target, find two distinct indices i and j such that nums[i] + nums[j] == target. Print the indices in ascending order (i < j). You may assume exactly one valid answer exists.",
    inputFormat:
      "Line 1: n\nLine 2: n space-separated integers\nLine 3: target",
    outputFormat: "Two indices i j (space-separated, i < j)",
    constraints: ["2 <= n <= 100000", "-10^9 <= nums[i] <= 10^9", "-10^9 <= target <= 10^9"],
    examples: [
      {
        input: "4\n2 7 11 15\n9",
        output: "0 1",
        explanation: "nums[0] + nums[1] = 2 + 7 = 9, so print indices 0 and 1.",
      },
    ],
    tests: [
      { input: "4\n2 7 11 15\n9", output: "0 1" },
      { input: "4\n3 2 4 8\n6", output: "1 2" },
    ],
    starterByLanguage: {
      python:
        "from typing import List, Tuple\n\n# Return (i, j) where i < j\ndef two_sum(nums: List[int], target: int) -> Tuple[int, int]:\n    # TODO\n    pass\n",
      javascript:
        "// Return [i, j] where i < j\nfunction twoSum(nums, target) {\n    // TODO\n    return [0, 0];\n}\n",
      java:
        "class Solution {\n  // Return int[]{i, j} where i < j\n  public static int[] twoSum(int[] nums, int target) {\n    // TODO\n    return new int[]{0, 0};\n  }\n}\n",
      c:
        "#include <stdio.h>\n\n// Set *out_i and *out_j (0-based), ensure *out_i < *out_j\nvoid two_sum(long long* nums, int n, long long target, int* out_i, int* out_j) {\n  // TODO\n}\n",
      cpp:
        "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n  // Return {i, j} where i < j\n  vector<int> twoSum(const vector<long long>& nums, long long target) {\n    // TODO\n    return {0, 0};\n  }\n};\n",
    },
  },
  {
    id: "product-array",
    title: "Product of Array Except Self",
    difficulty: "Medium",
    source: "LeetCode Inspired",
    description:
      "Given an integer array nums of length n, print an array output of length n where output[i] is the product of all elements of nums except nums[i].",
    inputFormat: "Line 1: n\nLine 2: n space-separated integers",
    outputFormat: "n integers space-separated",
    constraints: ["2 <= n <= 100000", "-30 <= nums[i] <= 30"],
    examples: [
      {
        input: "4\n1 2 3 4",
        output: "24 12 8 6",
        explanation: "output[0]=2*3*4=24, output[1]=1*3*4=12.",
      },
    ],
    tests: [
      { input: "4\n1 2 3 4", output: "24 12 8 6" },
      { input: "5\n-1 1 0 -3 3", output: "0 0 9 0 0" },
    ],
    starterByLanguage: {
      python:
        "from typing import List\n\n# Return output array\ndef product_except_self(nums: List[int]) -> List[int]:\n    # TODO\n    return []\n",
      javascript:
        "// Return output array\nfunction productExceptSelf(nums) {\n    // TODO\n    return [];\n}\n",
      java:
        "class Solution {\n  // Return output array\n  public static long[] productExceptSelf(int[] nums) {\n    // TODO\n    return new long[nums.length];\n  }\n}\n",
      c:
        "#include <stdio.h>\n\n// Write results into out[0..n-1]\nvoid product_except_self(long long* nums, int n, long long* out) {\n  // TODO\n}\n",
      cpp:
        "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n  vector<long long> productExceptSelf(const vector<long long>& nums) {\n    // TODO\n    return {};\n  }\n};\n",
    },
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    source: "Backend Interviews",
    description: "Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.",
    inputFormat: "Line 1: n (number of intervals)\nNext n lines: start end (space-separated)",
    outputFormat: "n lines of merged intervals: start end (space-separated)",
    constraints: ["1 <= n <= 10000", "0 <= starti <= endi <= 10000"],
    examples: [
      {
        input: "4\n1 3\n2 6\n8 10\n15 18",
        output: "1 6\n8 10\n15 18",
        explanation: "Since intervals [1,3] and [2,6] overlap, merge them into [1,6].",
      },
    ],
    tests: [
      { input: "4\n1 3\n2 6\n8 10\n15 18", output: "1 6\n8 10\n15 18" },
      { input: "2\n1 4\n4 5", output: "1 5" },
    ],
    starterByLanguage: {
      python: "from typing import List\n\ndef merge_intervals(intervals: List[List[int]]) -> List[List[int]]:\n    # TODO\n    return []\n",
      javascript: "function mergeIntervals(intervals) {\n    // TODO\n    return [];\n}\n",
      java: "import java.util.*;\n\nclass Solution {\n  public static int[][] mergeIntervals(int[][] intervals) {\n    // TODO\n    return new int[0][0];\n  }\n}\n",
      c: "#include <stdio.h>\n\nvoid merge_intervals() {\n  // TODO\n}\n",
      cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n  vector<vector<int>> mergeIntervals(vector<vector<int>>& intervals) {\n    // TODO\n    return {};\n  }\n};\n",
    },
  }
];

const FRONTEND_QUESTIONS: CodingQuestion[] = [
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    source: "Frontend Interviews",
    description: "Given a string containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. Print 'true' or 'false'.",
    inputFormat: "Line 1: string s",
    outputFormat: "true or false",
    constraints: ["1 <= s.length <= 10^4"],
    examples: [
      {
        input: "()[]{}",
        output: "true",
        explanation: "All brackets are closed in the correct order.",
      },
    ],
    tests: [
      { input: "()[]{}", output: "true" },
      { input: "(]", output: "false" },
      { input: "([)]", output: "false" },
    ],
    starterByLanguage: {
      python: "def is_valid(s: str) -> bool:\n    # TODO\n    return False\n",
      javascript: "function isValid(s) {\n    // TODO\n    return false;\n}\n",
      java: "class Solution {\n  public static boolean isValid(String s) {\n    // TODO\n    return false;\n  }\n}\n",
      c: "#include <stdio.h>\n#include <stdbool.h>\n\nbool is_valid(const char* s) {\n  // TODO\n  return false;\n}\n",
      cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n  bool isValid(const string& s) {\n    // TODO\n    return false;\n  }\n};\n",
    },
  },
  {
    id: "longest-substring",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    source: "Frontend Interviews",
    description: "Given a string s, print the length of the longest substring (contiguous) that contains no repeating characters.",
    inputFormat: "Line 1: string s",
    outputFormat: "Single integer answer",
    constraints: ["1 <= |s| <= 200000", "s contains only visible ASCII characters (no spaces)"],
    examples: [
      {
        input: "abcabcbb",
        output: "3",
        explanation: 'The answer is "abc" with length 3.',
      },
    ],
    tests: [
      { input: "abcabcbb", output: "3" },
      { input: "bbbbb", output: "1" },
      { input: "pwwkew", output: "3" },
    ],
    starterByLanguage: {
      python: "def length_of_longest_substring(s: str) -> int:\n    # TODO\n    return 0\n",
      javascript: "function lengthOfLongestSubstring(s) {\n    // TODO\n    return 0;\n}\n",
      java: "class Solution {\n  public static int lengthOfLongestSubstring(String s) {\n    // TODO\n    return 0;\n  }\n}\n",
      c: "#include <stdio.h>\n\nint length_of_longest_substring(const char* s) {\n  // TODO\n  return 0;\n}\n",
      cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n  int lengthOfLongestSubstring(const string& s) {\n    // TODO\n    return 0;\n  }\n};\n",
    },
  },
  {
    id: "flatten-array",
    title: "Flatten Nested Array",
    difficulty: "Medium",
    source: "Frontend Interviews",
    description: "Given a JSON string representing a deeply nested array of integers, flatten the array and return the integers space-separated.",
    inputFormat: "Line 1: A JSON string representing a nested array",
    outputFormat: "Space-separated integers",
    constraints: ["The nested depth is at most 10"],
    examples: [
      {
        input: "[1, [2, [3, 4], 5], 6]",
        output: "1 2 3 4 5 6",
        explanation: "All arrays are flattened into a single level.",
      },
    ],
    tests: [
      { input: "[1, [2, [3, 4], 5], 6]", output: "1 2 3 4 5 6" },
      { input: "[[[1]], 2]", output: "1 2" },
    ],
    starterByLanguage: {
      python: "import json\n\ndef flatten(arr):\n    # TODO\n    return []\n",
      javascript: "function flatten(arr) {\n    // TODO\n    return [];\n}\n",
      java: "import java.util.*;\n\nclass Solution {\n  public static List<Integer> flatten(String jsonArray) {\n    // TODO\n    return new ArrayList<>();\n  }\n}\n",
      c: "#include <stdio.h>\n\nvoid flatten(const char* s) {\n  // TODO\n}\n",
      cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n  void flatten(const string& s) {\n    // TODO\n  }\n};\n",
    },
  }
];

const DATA_QUESTIONS: CodingQuestion[] = [
  {
    id: "matrix-transpose",
    title: "Matrix Transpose",
    difficulty: "Easy",
    source: "Data/ML Interviews",
    description: "Given a 2D integer array matrix, return the transpose of matrix. The transpose of a matrix is the matrix flipped over its main diagonal.",
    inputFormat: "Line 1: r c (rows and columns)\nNext r lines: c space-separated integers",
    outputFormat: "c lines of r space-separated integers",
    constraints: ["1 <= r, c <= 1000"],
    examples: [
      {
        input: "2 3\n1 2 3\n4 5 6",
        output: "1 4\n2 5\n3 6",
        explanation: "The rows become columns.",
      },
    ],
    tests: [
      { input: "2 3\n1 2 3\n4 5 6", output: "1 4\n2 5\n3 6" },
      { input: "2 2\n1 2\n3 4", output: "1 3\n2 4" },
    ],
    starterByLanguage: {
      python: "from typing import List\n\ndef transpose(matrix: List[List[int]]) -> List[List[int]]:\n    # TODO\n    return []\n",
      javascript: "function transpose(matrix) {\n    // TODO\n    return [];\n}\n",
      java: "class Solution {\n  public static int[][] transpose(int[][] matrix) {\n    // TODO\n    return new int[0][0];\n  }\n}\n",
      c: "// Optional for C (starter omitted for brevity)\nvoid transpose() {}\n",
      cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n  vector<vector<int>> transpose(vector<vector<int>>& matrix) {\n    // TODO\n    return {};\n  }\n};\n",
    },
  },
  {
    id: "moving-average",
    title: "Moving Average from Data Stream",
    difficulty: "Medium",
    source: "Data/ML Interviews",
    description: "Given a stream of integers and a window size, calculate the moving average of all integers in the sliding window. Print the average (rounded to 2 decimal places) after each insertion.",
    inputFormat: "Line 1: window_size n\nNext n lines: integers",
    outputFormat: "n lines of averages (2 decimal places)",
    constraints: ["1 <= window_size <= 1000", "1 <= n <= 10000"],
    examples: [
      {
        input: "3 4\n1\n10\n3\n5",
        output: "1.00\n5.50\n4.67\n6.00",
        explanation: "avg(1)=1, avg(1,10)=5.5, avg(1,10,3)=4.666..., avg(10,3,5)=6",
      },
    ],
    tests: [
      { input: "3 4\n1\n10\n3\n5", output: "1.00\n5.50\n4.67\n6.00" },
      { input: "2 3\n4\n6\n8", output: "4.00\n5.00\n7.00" },
    ],
    starterByLanguage: {
      python: "def moving_average(window_size: int, nums: list[int]) -> list[float]:\n    # TODO\n    return []\n",
      javascript: "function movingAverage(windowSize, nums) {\n    // TODO\n    return [];\n}\n",
    },
  },
  {
    id: "missing-number",
    title: "Missing Number in Dataset",
    difficulty: "Easy",
    source: "Data/ML Interviews",
    description: "Given an array nums containing n distinct numbers in the range [0, n], return the only number in the range that is missing from the array.",
    inputFormat: "Line 1: n\nLine 2: n space-separated integers",
    outputFormat: "A single integer",
    constraints: ["1 <= n <= 10000"],
    examples: [
      {
        input: "3\n3 0 1",
        output: "2",
        explanation: "n=3, range is [0,3]. 2 is missing.",
      },
    ],
    tests: [
      { input: "3\n3 0 1", output: "2" },
      { input: "9\n9 6 4 2 3 5 7 0 1", output: "8" },
    ],
    starterByLanguage: {
      python: "def missing_number(nums: list[int]) -> int:\n    # TODO\n    return 0\n",
      javascript: "function missingNumber(nums) {\n    // TODO\n    return 0;\n}\n",
    },
  }
];

const DATABASE_QUESTIONS: CodingQuestion[] = [
  {
    id: "sql-select-filter",
    title: "Basic SELECT and WHERE",
    difficulty: "Easy",
    source: "Database Interviews",
    description: "Write a SQL query to select all users whose city is 'Delhi' and sort them by name ascending.",
    inputFormat: "Table schema: users (id INTEGER, name TEXT, city TEXT)",
    outputFormat: "name, city",
    constraints: ["Use standard SQL"],
    examples: [
      {
        input: "Hidden schema setup",
        output: "Alice|Delhi\nCarol|Delhi",
        explanation: "Select name and city for Delhi users.",
      },
    ],
    tests: [
      { 
        input: "CREATE TABLE users (id INTEGER, name TEXT, city TEXT);\nINSERT INTO users VALUES (1, 'Carol', 'Delhi'), (2, 'Bob', 'Mumbai'), (3, 'Alice', 'Delhi');\n", 
        output: "Alice|Delhi\nCarol|Delhi" 
      },
    ],
    starterByLanguage: {
      sql: "-- Write your SQL query here\nSELECT * FROM users;\n",
    },
  },
  {
    id: "sql-group-by",
    title: "Group By Aggregation",
    difficulty: "Medium",
    source: "Database Interviews",
    description: "Write a SQL query to find the total salary for each department. Output the department name and total salary, sorted by total salary descending.",
    inputFormat: "Table schema: employees (id INTEGER, name TEXT, dept TEXT, salary INTEGER)",
    outputFormat: "dept, total_salary",
    constraints: ["Use standard SQL"],
    examples: [
      {
        input: "Hidden schema setup",
        output: "Engineering|170000\nSales|105000",
        explanation: "Engineering = 80k+90k, Sales = 50k+55k.",
      },
    ],
    tests: [
      { 
        input: "CREATE TABLE employees (id INTEGER, name TEXT, dept TEXT, salary INTEGER);\nINSERT INTO employees VALUES (1, 'Alice', 'Engineering', 80000), (2, 'Bob', 'Sales', 50000), (3, 'Carol', 'Engineering', 90000), (4, 'Dave', 'Sales', 55000);\n", 
        output: "Engineering|170000\nSales|105000" 
      },
    ],
    starterByLanguage: {
      sql: "-- Write your SQL query here\nSELECT dept, SUM(salary) as total_salary FROM employees GROUP BY dept;\n",
    },
  },
  {
    id: "sql-join",
    title: "INNER JOIN Query",
    difficulty: "Medium",
    source: "Database Interviews",
    description: "Write a SQL query to find the names of customers who have made an order of more than 500. Join the customers and orders tables.",
    inputFormat: "customers (id, name), orders (id, customer_id, amount)",
    outputFormat: "name",
    constraints: ["Use standard SQL"],
    examples: [
      {
        input: "Hidden schema setup",
        output: "Alice",
        explanation: "Only Alice has an order amount > 500.",
      },
    ],
    tests: [
      { 
        input: "CREATE TABLE customers (id INTEGER, name TEXT);\nCREATE TABLE orders (id INTEGER, customer_id INTEGER, amount INTEGER);\nINSERT INTO customers VALUES (1, 'Alice'), (2, 'Bob');\nINSERT INTO orders VALUES (101, 1, 600), (102, 2, 300);\n", 
        output: "Alice" 
      },
    ],
    starterByLanguage: {
      sql: "-- Write your SQL query here\nSELECT customers.name FROM customers JOIN orders ON customers.id = orders.customer_id;\n",
    },
  }
];

export const CODING_QUESTIONS_BY_ROLE: Record<string, CodingQuestion[]> = {
  FULLSTACK: BACKEND_QUESTIONS,
  BACKEND: BACKEND_QUESTIONS,
  FRONTEND: FRONTEND_QUESTIONS,
  DATA: DATA_QUESTIONS,
  AI_ML: DATA_QUESTIONS,
  DATABASE: DATABASE_QUESTIONS,
  GENERAL: BACKEND_QUESTIONS,
};

// Fallback for code that imports the old array directly (like tests or initial renders)
export const CODING_QUESTIONS = BACKEND_QUESTIONS;

export function getPistonLanguage(language: CodingLanguage): string {
  switch (language) {
    case "python":
      return "python";
    case "javascript":
      return "javascript";
    case "java":
      return "java";
    case "c":
      return "c";
    case "cpp":
      return "cpp";
    case "sql":
      return "sqlite3";
    default:
      return "python";
  }
}
