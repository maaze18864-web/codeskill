export type PracticeCard = {
  title: string;
  type: string;
  topic: string;
  prompt: string;
  code?: string;
  choices?: readonly string[];
  acceptedAnswers: readonly string[];
  inputLabel?: string;
  answer: string;
  explanation: string;
  color: "mint" | "peach" | "lavender" | "citrus" | "sky" | "rose" | "apricot" | "periwinkle" | "lime" | "blush" | "butter" | "aqua";
};

/** Authored homepage exercises, separate from the database question bank. */
export const practiceCards: readonly PracticeCard[] = [
  { title: "A faster pair", type: "MCQ", topic: "Arrays", prompt: "Which approach finds two values summing to a target in O(n) expected time?", choices: ["Sort, then nested loops", "One pass with a hash map", "Try every pair"], acceptedAnswers: ["One pass with a hash map"], answer: "One pass with a hash map.", explanation: "For each value x, look for target − x among previously seen values, then store x. This uses O(n) extra space.", color: "mint" },
  { title: "Smallest window", type: "Coding", topic: "Sliding window", prompt: "For positive integers [2, 3, 1, 2, 4, 3], find the shortest contiguous subarray with sum at least 7.", acceptedAnswers: ["2"], inputLabel: "Enter the minimum length (a number)", answer: "Length 2: [4, 3].", explanation: "Expand a right pointer to reach the target; then move the left pointer while the sum remains large enough. Each pointer moves at most n times.", color: "peach" },
  { title: "The search rule", type: "True / False", choices: ["True", "False"], topic: "Binary search", prompt: "Binary search can be applied to any unsorted array without changing its order.", acceptedAnswers: ["False"], answer: "False.", explanation: "Binary search needs a monotonic condition, such as a sorted array, to safely discard half of the search space.", color: "lavender" },
  { title: "One step too far", type: "Find the bug", topic: "Array bounds", prompt: "This loop should add every element. Which condition causes an out-of-bounds read?", code: `for (int i = 0; i <= n; i++)
  sum += a[i];`, acceptedAnswers: ["i < n", "n > i"], inputLabel: "Write the corrected loop condition", answer: "Replace i <= n with i < n.", explanation: "An array of n elements has valid indices 0 through n − 1. The iteration at i = n reads beyond the array.", color: "citrus" },
  { title: "Remember the best", type: "Fill the blank", topic: "Dynamic programming", prompt: "Complete Kadane’s recurrence for the best subarray ending at index i.", code: `best = max(a[i], ____ + a[i]);`, acceptedAnswers: ["best"], inputLabel: "Fill the blank with the variable name", answer: "The previous value of best.", explanation: "Either start a new subarray at a[i], or extend the best subarray ending at i − 1. Track a separate global maximum.", color: "sky" },
  { title: "Close the bracket", type: "Missing line", topic: "Stacks", prompt: "While validating brackets, what comes after a closing bracket matches the stack’s top?", code: `if matches(stack[-1], ch):
    ______`, acceptedAnswers: ["stack.pop()"], inputLabel: "Write the missing Python line", answer: "stack.pop()", explanation: "Remove the matched opening bracket. Check the stack is nonempty before reading its top, and require it to be empty at the end.", color: "rose" },
  { title: "Follow the queue", type: "Code output", topic: "Queues", prompt: "What value does the final operation print?", code: `q = deque([4, 7, 9])
q.append(q.popleft() + 1)
print(q.popleft())`, acceptedAnswers: ["7"], inputLabel: "Enter the printed output", answer: "7", explanation: "The first removal takes 4; appending 5 leaves [7, 9, 5]. The next removal returns 7. Assume deque is imported.", color: "apricot" },
  { title: "The shortest route", type: "MCQ", topic: "Graphs", prompt: "Which traversal finds shortest paths from a source in an unweighted graph?", choices: ["Depth-first search", "Breadth-first search", "In-order traversal"], acceptedAnswers: ["Breadth-first search"], answer: "Breadth-first search (BFS).", explanation: "BFS explores vertices in layers of increasing edge distance. Mark each vertex when enqueuing it to avoid repeated visits.", color: "periwinkle" },
  { title: "Can we split it?", type: "True / False", choices: ["True", "False"], topic: "Greedy algorithms", prompt: "Choosing the largest available coin always gives the fewest coins for any denomination set.", acceptedAnswers: ["False"], answer: "False.", explanation: "For coins [1, 3, 4] and target 6, greedy uses 4 + 1 + 1, but the optimum is 3 + 3. Dynamic programming handles general denominations.", color: "lime" },
  { title: "First unique", type: "Coding", topic: "Hash maps", prompt: "Return the index of the first character that appears once in ‘aabbcdde’. Use O(n) time.", acceptedAnswers: ["4"], inputLabel: "Enter the zero-based index (a number)", answer: "Index 4: ‘c’ (zero-based).", explanation: "Count character frequencies in one pass, then scan the original string for the first frequency of one. Preserve the original order.", color: "blush" },
  { title: "A safe midpoint", type: "Fill the blank", topic: "Binary search", prompt: "Fill the blank to avoid adding two potentially large indices.", code: `mid = low + (____ - low) / 2;`, acceptedAnswers: ["high"], inputLabel: "Fill the blank with the variable name", answer: "high", explanation: "With nonnegative low ≤ high in range, low + (high − low) / 2 avoids the overflow that low + high can cause in fixed-width integer arithmetic.", color: "butter" },
  { title: "Visit just once", type: "Missing line", topic: "Graph traversal", prompt: "Before enqueuing an unseen neighbor v in BFS, which line prevents duplicate discovery?", code: `if not visited[v]:
    ______
    queue.append(v)`, acceptedAnswers: ["visited[v] = True"], inputLabel: "Write the missing Python line", answer: "visited[v] = True", explanation: "Mark on discovery, before enqueuing. Marking only when removing from the queue can enqueue the same vertex through several incoming edges.", color: "aqua" },
];
