const fs = require('fs');
const sql = fs.readFileSync(process.argv[2], 'utf8');
const drops = [...sql.matchAll(/drop policy if exists\s+"([^"]+)"\s+on\s+([\w.]+)/gi)]
  .map(m => ({ name: m[1], table: m[2] }));
const creates = [...sql.matchAll(/create policy\s+"([^"]+)"\s*\n?\s*on\s+([\w.]+)/gi)]
  .map(m => ({ name: m[1], table: m[2] }));

const createKeys = new Set(creates.map(c => c.table + '::' + c.name));
const dropKeys = new Set(drops.map(d => d.table + '::' + d.name));

let bad = 0;
// every create must have a matching drop (idempotency)
for (const c of creates) {
  const k = c.table + '::' + c.name;
  if (!dropKeys.has(k)) { console.log('ORPHAN CREATE (no matching drop): ' + k); bad++; }
}
// every drop must target a real create
for (const d of drops) {
  const k = d.table + '::' + d.name;
  if (!createKeys.has(k)) { console.log('ORPHAN DROP (no matching create): ' + k); bad++; }
}
// duplicate creates would error on first run
const seen = new Map();
for (const c of creates) {
  const k = c.table + '::' + c.name;
  seen.set(k, (seen.get(k)||0)+1);
}
for (const [k,n] of seen) if (n>1) { console.log('DUPLICATE CREATE x'+n+': '+k); bad++; }

console.log('\ndrops: '+drops.length+'  creates: '+creates.length+'  unique creates: '+seen.size);
console.log(bad === 0 ? 'POLICY CHECKS PASSED' : bad+' problem(s)');

// Any RLS-enabled table with zero policies silently blocks every query.
const rls = [...sql.matchAll(/alter table ([\w.]+)\s+enable row level security/gi)].map(m=>m[1]);
const tblWithPolicy = new Set(creates.map(c=>c.table));
const locked = rls.filter(t => !tblWithPolicy.has(t));
console.log('\nRLS enabled: '+rls.length+' tables');
if (locked.length) { console.log('  UNREACHABLE (RLS on, no policies): '+locked.join(', ')); process.exitCode = 1; }
else console.log('  every RLS table has at least one policy');
