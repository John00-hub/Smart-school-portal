const { parse, parsePlPgSQL, hasSqlDetails } = require('libpg-query');
const fs = require('fs');
const file = process.argv[2];
const sql = fs.readFileSync(file, 'utf8');

function report(e) {
  if (hasSqlDetails(e)) {
    const d = e.sqlDetails;
    const line = sql.slice(0, d.cursorPosition).split('\n').length;
    const lines = sql.split('\n');
    console.log('  message: ' + d.message);
    console.log('  near line ' + line + ':');
    for (let i = Math.max(0, line-3); i < Math.min(lines.length, line+3); i++)
      console.log('   ' + (i+1) + (i+1===line ? ' >>> ' : '     ') + lines[i]);
  } else console.log('  ' + e.message);
}

(async () => {
  let stmts;
  try {
    const res = await parse(sql);
    stmts = res.stmts || [];
    console.log('[1/3] Top-level parse OK - statements: ' + stmts.length);
  } catch (e) { console.log('[1/3] PARSE FAILED'); report(e); process.exit(1); }

  // Walk every CREATE FUNCTION, keeping its true name, args and return type.
  const fns = [];
  const re = /create\s+or\s+replace\s+function\s+((?:public\.)?[\w_]+)\s*\(([\s\S]*?)\)\s*returns\s+(table\s*\([\s\S]*?\)|[\w_]+)\s+([\s\S]*?)\$\$([\s\S]*?)\$\$/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    fns.push({
      name: m[1], args: m[2], ret: m[3], clause: m[4],
      line: sql.slice(0, m.index).split('\n').length,
      body: m[5],
    });
  }
  console.log('[2/3] CREATE FUNCTION statements: ' + fns.length);

  let fails = 0;
  for (const f of fns) {
    const isTable = /^table/i.test(f.ret);
    // For RETURNS TABLE the plpgsql body must not exist; those are LANGUAGE sql.
    if (/language\s+sql/i.test(f.clause)) {
      try { await parse('create function __probe(' + f.args + ') returns ' + f.ret + ' language sql as $$ ' + f.body + ' $$;');
            console.log('   ok   sql   line ' + String(f.line).padStart(4) + '  ' + f.name); }
      catch (e) { fails++; console.log('   FAIL sql   line ' + f.line + '  ' + f.name + '  ->  ' + e.message); }
      continue;
    }
    const retClause = isTable ? f.ret : f.ret;
    try {
      await parsePlPgSQL(
        'create function __probe(' + f.args + ') returns ' + retClause +
        ' language plpgsql as $$ ' + f.body + ' $$;'
      );
      console.log('   ok   plpgsql line ' + String(f.line).padStart(4) + '  ' + f.name);
    } catch (e) {
      fails++;
      console.log('   FAIL plpgsql line ' + f.line + '  ' + f.name + '  ->  ' + e.message);
    }
  }

  // [3/3] sanity: required objects present
  // Only assert the 16 core tables when this file is the BASE schema.
  // A migration file creates/alters a subset, so the assertion would be wrong.
  const isSchema = /create table if not exists public\.profiles/i.test(sql);
  const need = ['profiles','students','teachers','parents','parent_student_links','classes',
    'subjects','teacher_assignments','enrollments','results','attendance','timetables',
    'announcements','academic_sessions','terms','activity_logs'];
  const missing = need.filter(t => !new RegExp('create table if not exists public\\.' + t + '\\b').test(sql));
  if (!isSchema) {
    console.log('[3/3] Not a schema file - table/RLS assertions skipped');
    console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\nFAILURES PRESENT');
    process.exit(fails === 0 ? 0 : 1);
  }
  console.log('[3/3] Required tables: ' + (need.length - missing.length) + '/' + need.length +
              (missing.length ? '  MISSING: ' + missing.join(', ') : ''));
  const polCount = (sql.match(/create policy/g) || []).length;
  const rlsCount = (sql.match(/enable row level security/g) || []).length;
  console.log('      RLS enabled on ' + rlsCount + ' tables, ' + polCount + ' policies created');
  console.log('      service_role key leaked in file: ' + (/service[_-]?role/i.test(sql) && /eyJ/.test(sql) ? 'YES - REMOVE IT' : 'no'));

  console.log(fails === 0 && missing.length === 0 ? '\nALL CHECKS PASSED' : '\nFAILURES PRESENT');
  process.exit(fails === 0 && missing.length === 0 ? 0 : 1);
})();
