// Constant worker program. Queries are data, never JavaScript or host SQL.
export const SQL_WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const path = require('node:path');
(async () => {
  const SQL = await require(workerData.engine)({locateFile: file => path.join(path.dirname(workerData.engine), file)});
  const query = workerData.query.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/g, '');
  if (!/^(SELECT|WITH)\b/i.test(query)) throw new Error('Use a single read-only SELECT or WITH query.');
  const results=[];
  for (const dataset of workerData.datasets) {
    const db = new SQL.Database();
    const started=performance.now();
    try {
      db.run('PRAGMA hard_heap_limit=33554432; PRAGMA temp_store=MEMORY; PRAGMA trusted_schema=OFF;');
      db.run(workerData.schemaSql); db.run(dataset.seedSql);
      db.run('PRAGMA query_only=ON;');
      const statements=db.iterateStatements(query);
      const first=statements.next();
      if(first.done) throw new Error('Enter a SELECT query.');
      const statement=first.value;
      const columns=statement.getColumnNames();
      if(!columns.length || columns.length>32) throw new Error('Return 1–32 columns.');
      const rows=[]; let bytes=0;
      while(statement.step()) {
        const row=statement.get();
        if(row.some(value=>value instanceof Uint8Array || typeof value==='string'&&value.length>4096)) throw new Error('Result cells must be text, numbers or NULL, up to 4096 characters.');
        bytes+=JSON.stringify(row).length;
        if(rows.length>=200 || bytes>64000) throw new Error('Result exceeds 200 rows or 64 KB.');
        rows.push(row);
      }
      if(!statements.next().done) throw new Error('Use one SELECT statement per submission.');
      results.push({columns,rows,timeMs:performance.now()-started});
    } catch(error) { results.push({error:String(error.message).slice(0,240),timeMs:performance.now()-started}); }
    finally {db.close();}
  }
  parentPort.postMessage({results});
})().catch(error=>parentPort.postMessage({error:String(error.message).slice(0,240)}));
`;
