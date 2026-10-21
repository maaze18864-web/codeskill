import api, { problemsAPI } from "@/config/api";
import { normalizeProblemQuery, parsePublicProblemList } from "@/lib/public-problems";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";

const problem = { id: "one", slug: "two-sum", title: "Two Sum", difficulty: "easy", categories: ["Arrays"], stats: { acceptanceRate: 42 } };

it.each(["", "  ", undefined, null, "undefined", "null", " All Topics ", "all topics"])("omits default or invalid topic %s", value => {
  expect(normalizeProblemQuery(value, true)).toBeUndefined();
});

it("normalizes real query values without treating a topic as a search default", () => {
  expect(normalizeProblemQuery("  Arrays ", true)).toBe("Arrays");
  expect(normalizeProblemQuery("  Two Sum ")).toBe("Two Sum");
  expect(normalizeProblemQuery("All Topics")).toBe("All Topics");
});

it.each([
  { data: [problem], total: 41, totalPages: 3 },
  { problems: [problem], total: 41, pages: 3 },
  { data: [problem], pagination: { total: 41, totalPages: 3 } },
])("parses supported public response envelopes", response => {
  const parsed = parsePublicProblemList(response);
  expect(parsed.total).toBe(41);
  expect(parsed.totalPages).toBe(3);
  expect(parsed.problems[0]).toMatchObject({ id: "one", slug: "two-sum", difficulty: "Easy", categories: ["Arrays"], stats: { acceptanceRate: 42 } });
});

it("supports direct arrays and legacy _id with safe missing optional fields", () => {
  const parsed = parsePublicProblemList([{ _id: "old", title: "Old Problem", difficulty: "MEDIUM" }]);
  expect(parsed).toMatchObject({ total: 1, totalPages: 1, problems: [{ id: "old", difficulty: "Medium", categories: [], stats: { acceptanceRate: 0 } }] });
  expect(parsed.problems[0].slug).toBeUndefined();
});

it("accepts a genuine empty list and derives pagination when only total is given", () => {
  expect(parsePublicProblemList({ data: [], total: 0, pages: 0 })).toEqual({ problems: [], total: 0, totalPages: 1 });
  expect(parsePublicProblemList({ data: [problem], total: 42 }).totalPages).toBe(3);
});

it.each([null, {}, { data: null }, { data: [{ title: "No identity" }] }])("rejects malformed response instead of silently displaying an empty table", response => {
  expect(() => parsePublicProblemList(response)).toThrow();
});

it("requests the public endpoint without authentication or default topic and passes cancellation", async () => {
  localStorage.clear();
  const originalAdapter = api.defaults.adapter;
  let request: InternalAxiosRequestConfig | undefined;
  const adapter: AxiosAdapter = async config => {
    request = config;
    return { data: { data: [problem], total: 1, totalPages: 1 }, status: 200, statusText: "OK", headers: {}, config };
  };
  api.defaults.adapter = adapter;
  try {
    const controller = new AbortController();
    const response = await problemsAPI.getAll(1, 20, "", " All Topics ", controller.signal);
    expect(request?.url).toBe("problems");
    expect(request?.params).toEqual({ page: 1, limit: 20 });
    expect(request?.headers.Authorization).toBeUndefined();
    expect(request?.signal).toBe(controller.signal);
    expect(response.data.data[0]._id).toBe("one");
    await problemsAPI.getAll(2, 20, "  two & sum ", " Arrays ");
    expect(request?.params).toEqual({ page: 2, limit: 20, search: "two & sum", category: "Arrays" });
    await problemsAPI.getAll(1, 5, "", "All Topics", controller.signal, "Hard");
    expect(request?.params).toEqual({ page: 1, limit: 5, difficulty: "Hard" });
  } finally {
    api.defaults.adapter = originalAdapter;
  }
});
