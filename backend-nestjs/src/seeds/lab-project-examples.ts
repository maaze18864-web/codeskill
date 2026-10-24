import { createProjectTemplate } from '../projects/project-catalog';
import {
  LabProjectTemplate,
  validateLabProjectTemplate,
} from '../projects/lab-project-template';

export function fullstackExercise(
  name: string,
  feedback = false,
): LabProjectTemplate {
  const base = createProjectTemplate({
    name,
    mode: 'fullstack',
    frontendStack: 'react',
    backendStack: 'express',
  });
  const instructions = feedback
    ? `Complete a feedback form from the supplied React + Express project.\n\n1. frontend/src/main.jsx: implement submitFeedback so it sends the form as JSON to the project's /api/feedback route and displays the server response.\n2. backend/server.js: implement validation: name must be non-empty, rating must be an integer from 1 to 5, and comment must contain at least 10 characters. Return HTTP 400 with {error: "Invalid feedback"} for invalid requests.\n3. A valid request returns HTTP 201 with {message: "Feedback received"}.\n\nUse API Client: POST /api/feedback with {"name":"Ada","rating":5,"comment":"Clear explanations"}. Also test an empty name and rating 9. Verify the form in Preview. Do not remove the validation UI or TODO instructions.`
    : `Finish the missing parts of a React + Express task board.\n\n1. backend/server.js: GET /api/tasks returns the tasks array. POST /api/tasks validates a trimmed, non-empty title (max 80 characters), assigns a unique id, stores the task, and returns it with HTTP 201. Invalid titles return HTTP 400.\n2. frontend/src/main.jsx: implement loadTasks and addTask. Use the project-relative api path, fetch tasks when the page opens, and refresh the list after adding a task. Show errors and clear the input after success.\n\nTest GET /api/tasks and POST /api/tasks with {"title":"Learn SQL"} in API Client. Then add a task in Preview. Task data is intentionally in-memory and resets when the project restarts.`;
  const main = feedback
    ? `import React, { useState } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './style.css';\nfunction App() {\n  const [name, setName] = useState('');\n  const [rating, setRating] = useState(5);\n  const [comment, setComment] = useState('');\n  const [message, setMessage] = useState('Complete submitFeedback to connect this form.');\n  async function submitFeedback(event) {\n    event.preventDefault();\n    // TODO: POST {name, rating, comment} to import.meta.env.BASE_URL + 'api/feedback'.\n    // TODO: display the returned message or validation error.\n    setMessage('TODO: connect the feedback API');\n  }\n  return <main><p className="eyebrow">FULLSTACK LAB</p><h1>Course feedback</h1><form onSubmit={submitFeedback}><label>Name<input value={name} onChange={e => setName(e.target.value)} /></label><label>Rating<input type="number" min="1" max="5" value={rating} onChange={e => setRating(Number(e.target.value))} /></label><label>Comment<textarea value={comment} onChange={e => setComment(e.target.value)} /></label><button>Send feedback</button></form><p role="status">{message}</p></main>;\n}\ncreateRoot(document.getElementById('app')).render(<App />);\n`
    : `import React, { useEffect, useState } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './style.css';\nfunction App() {\n  const [tasks, setTasks] = useState([]);\n  const [title, setTitle] = useState('');\n  const [error, setError] = useState('');\n  async function loadTasks() {\n    // TODO: fetch import.meta.env.BASE_URL + 'api/tasks' and setTasks.\n  }\n  async function addTask(event) {\n    event.preventDefault();\n    // TODO: POST the title as JSON, handle errors, reload tasks, clear title.\n    setError('TODO: connect the task API');\n  }\n  useEffect(() => { loadTasks(); }, []);\n  return <main><p className="eyebrow">FULLSTACK LAB</p><h1>My task board</h1><form onSubmit={addTask}><input aria-label="Task title" placeholder="What needs doing?" value={title} onChange={e => setTitle(e.target.value)} /><button>Add task</button></form><p role="alert">{error}</p><ul>{tasks.map(task => <li key={task.id}>{task.title}</li>)}</ul><p>{tasks.length} tasks</p></main>;\n}\ncreateRoot(document.getElementById('app')).render(<App />);\n`;
  const server = `import express from 'express';\nconst app = express();\napp.use(express.json());\napp.get('/health', (_req, res) => res.json({status: 'ok'}));\n${feedback ? `app.post('/api/feedback', (req, res) => {\n  // TODO: validate name, rating and comment as described in Instructions.\n  // TODO: return HTTP 400 for invalid data, or HTTP 201 for valid feedback.\n  res.status(501).json({error: 'Implement feedback validation'});\n});` : `const tasks = [{id: 1, title: 'Read the experiment instructions'}];\napp.get('/api/tasks', (_req, res) => {\n  // TODO: return the tasks array as JSON.\n  res.json([]);\n});\napp.post('/api/tasks', (req, res) => {\n  // TODO: validate title, create/store a task with a unique id, and return 201.\n  res.status(501).json({error: 'Implement task creation'});\n});`}\napp.listen(3001, '127.0.0.1');\n`;
  return validateLabProjectTemplate({
    ...base,
    frontendStack: 'react',
    backendStack: 'express',
    instructions,
    files: base.files.map((file) =>
      file.path === 'frontend/src/main.jsx'
        ? { ...file, content: main }
        : file.path === 'backend/server.js'
          ? { ...file, content: server }
          : file.path === 'frontend/src/style.css'
            ? {
                ...file,
                content:
                  file.content +
                  '\nform {display:grid;gap:12px} label {display:grid;gap:6px} input,textarea {font:inherit;padding:10px;border:1px solid #ccd4df;border-radius:8px} li {padding:8px}\n',
              }
            : file,
    ),
  });
}
export function dbmsExercise(joins = false): LabProjectTemplate {
  const name = joins ? 'Student department report' : 'Department credit totals';
  const base = createProjectTemplate({
    name,
    mode: 'backend',
    backendStack: 'flask',
  });
  const instructions = joins
    ? `Complete backend/query.sql using an INNER JOIN between students and departments. Return name, department (the department name), and credits for students with at least 20 credits, ordered by name.\n\nSchema: students(id, name, department_id, credits); departments(id, name).\nExpected rows: Ada / Computing / 24; Grace / Computing / 30; Linus / Electronics / 22.\n\nRun the project and request GET /api/report in API Client. SQLite is embedded in this disposable project; no production database is accessed.`
    : `Complete backend/query.sql using GROUP BY and SUM. Return department_id and total_credits for each department whose total credits are at least 40, ordered by department_id.\n\nSchema: students(id, name, department_id, credits).\nSeed rows: Ada (1,24), Grace (1,30), Linus (2,22), Ken (2,18), Edsger (3,16).\nExpected rows: {department_id:1,total_credits:54}, {department_id:2,total_credits:40}.\n\nRun the project and request GET /api/report in API Client. Edit the SQL file, Apply changes, and request again. SQLite runs inside the isolated project.`;
  const main = `from flask import Flask, jsonify\nimport sqlite3\nfrom pathlib import Path\napp = Flask(__name__)\n@app.get('/health')\ndef health():\n    return {'status': 'ok'}\n@app.get('/api/report')\ndef report():\n    with sqlite3.connect(':memory:') as db:\n        db.row_factory = sqlite3.Row\n        db.executescript("CREATE TABLE departments(id INTEGER PRIMARY KEY, name TEXT); INSERT INTO departments VALUES(1,'Computing'),(2,'Electronics'),(3,'Mathematics'); CREATE TABLE students(id INTEGER PRIMARY KEY, name TEXT, department_id INTEGER, credits INTEGER); INSERT INTO students VALUES(1,'Ada',1,24),(2,'Grace',1,30),(3,'Linus',2,22),(4,'Ken',2,18),(5,'Edsger',3,16);")\n        query = Path(__file__).with_name('query.sql').read_text()\n        try:\n            return jsonify([dict(row) for row in db.execute(query)])\n        except sqlite3.Error as error:\n            return jsonify({'error': str(error)}), 400\n`;
  return validateLabProjectTemplate({
    ...base,
    frontendStack: undefined,
    backendStack: 'flask',
    instructions,
    files: [
      ...base.files.map((file) =>
        file.path === 'backend/main.py' ? { ...file, content: main } : file,
      ),
      {
        path: 'backend/query.sql',
        content:
          '-- TODO: replace this placeholder query using the experiment instructions.\nSELECT name FROM students WHERE 0;\n',
      },
    ],
  });
}
