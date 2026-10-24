import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { Worker } from 'node:worker_threads';
import { SQL_WORKER_SOURCE } from './sql-worker';
import { SqlProblem, SqlTable } from './sql-problem';
interface QueryResult extends Partial<SqlTable> {
  error?: string;
  timeMs: number;
}
export interface SqlFeedback {
  status: string;
  passedCount: number;
  totalCount: number;
  time: number;
  results: Array<{
    id: number;
    passed: boolean;
    isHidden: boolean;
    status: string;
    input?: string;
    output?: string;
    expected?: string;
    error?: string;
    columns?: string[];
    rows?: SqlTable['rows'];
  }>;
}
@Injectable()
export class SqlEngineService {
  private active = 0;
  private waiting: Array<() => void> = [];
  private owners = new Set<string>();
  async evaluate(
    problem: SqlProblem,
    query: string,
    submit: boolean,
    key: string,
  ): Promise<SqlFeedback> {
    if (typeof query !== 'string' || !query.trim() || query.length > 20000)
      throw new BadRequestException('Use a SQL query up to 20,000 characters.');
    if (this.owners.has(key))
      throw new HttpException('A SQL request is already running.', 429);
    if (this.waiting.length >= 10)
      throw new ServiceUnavailableException(
        'SQL execution is busy. Retry shortly.',
      );
    this.owners.add(key);
    if (this.active >= 2)
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.active++;
    try {
      const datasets = problem.datasets.filter(
        (dataset) => submit || !dataset.isHidden,
      );
      const data = await new Promise<QueryResult[]>((resolve, reject) => {
        const worker = new Worker(SQL_WORKER_SOURCE, {
          eval: true,
          env: {},
          resourceLimits: { maxOldGenerationSizeMb: 64, stackSizeMb: 2 },
          workerData: {
            engine: require.resolve('sql.js'),
            schemaSql: problem.schemaSql,
            datasets: datasets.map((dataset) => ({ seedSql: dataset.seedSql })),
            query,
          },
        });
        const timer = setTimeout(() => {
          void worker.terminate();
          resolve(
            datasets.map(() => ({
              error: 'Query time limit exceeded.',
              timeMs: 4000,
            })),
          );
        }, 4000);
        worker.once(
          'message',
          (message: { results?: QueryResult[]; error?: string }) => {
            clearTimeout(timer);
            void worker.terminate();
            resolve(
              message.results ||
                datasets.map(() => ({
                  error: message.error || 'SQL query failed.',
                  timeMs: 0,
                })),
            );
          },
        );
        worker.once('error', () => {
          clearTimeout(timer);
          reject(new ServiceUnavailableException('SQL engine is unavailable.'));
        });
        worker.once('exit', (code) => {
          if (code !== 0) {
            clearTimeout(timer);
            reject(
              new ServiceUnavailableException(
                'SQL engine stopped unexpectedly.',
              ),
            );
          }
        });
      });
      const results = datasets.map((dataset, index) => {
        const actual = data[index];
        const normalize = (rows: SqlTable['rows']) => {
          const serialized = rows.map((row) => JSON.stringify(row));
          return problem.orderMatters ? serialized : serialized.sort();
        };
        const passed =
          !actual.error &&
          JSON.stringify(
            actual.columns?.map((column) => column.toLowerCase()),
          ) ===
            JSON.stringify(
              dataset.expected.columns.map((column) => column.toLowerCase()),
            ) &&
          JSON.stringify(normalize(actual.rows || [])) ===
            JSON.stringify(normalize(dataset.expected.rows));
        const base = {
          id: index + 1,
          passed,
          isHidden: dataset.isHidden,
          status: passed
            ? 'accepted'
            : actual.error
              ? 'runtime_error'
              : 'wrong_answer',
        };
        return dataset.isHidden
          ? base
          : {
              ...base,
              columns: actual.columns,
              rows: actual.rows,
              input: dataset.seedSql,
              output: JSON.stringify({
                columns: actual.columns,
                rows: actual.rows,
              }),
              expected: JSON.stringify(dataset.expected),
              error: actual.error,
            };
      });
      const passedCount = results.filter((result) => result.passed).length;
      return {
        status: passedCount === results.length ? 'accepted' : 'wrong_answer',
        passedCount,
        totalCount: results.length,
        time: data.reduce((sum, result) => sum + result.timeMs, 0) / 1000,
        results,
      };
    } finally {
      this.owners.delete(key);
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}
