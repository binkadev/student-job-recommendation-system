import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { local, readLocal, writeLocal } from './helpers.mjs';

// No Admin login, UPDATE or normalization of the strict baseline. The original
// row hash cannot reveal old per-column values. Preserve that evidence limit.
const sql=q=>execFileSync('docker',['exec','-i','student-job-recommendation-system-postgres-1','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -v ON_ERROR_STOP=1'],{input:`BEGIN READ ONLY;\n${q}\nCOMMIT;`,encoding:'utf8'}).trim();
const baseline=readLocal('manual-final-baseline.json');
const preservation=readLocal('manual-final-preservation.json');
assert.deepEqual(preservation.mismatches,[{table:'users',id:'1',missing:false}]);
const admin=JSON.parse(sql(`select json_build_object('id',id,'role',role,'status',status,'lastLoginAt',last_login_at,'updatedAt',updated_at,'createdAt',created_at,'strictHash',md5(row_to_json(u)::text),'businessHash',md5((to_jsonb(u)-'last_login_at'-'updated_at')::text)) from users u where id=1;`));
assert.equal(admin.role,'ADMIN');assert.equal(admin.status,'ACTIVE');
assert.notEqual(admin.strictHash,baseline.rows.users['1']);
let originalRows=0;
for(const [table,rows] of Object.entries(baseline.rows)) originalRows+=Object.keys(rows).length;
const checkpointName='manual-final-admin-business-checkpoint.json';
if(!fs.existsSync(`${local}/${checkpointName}`)) writeLocal(checkpointName,{measuredAt:new Date().toISOString(),strictHash:admin.strictHash,businessHash:admin.businessHash,lastLoginAt:admin.lastLoginAt,updatedAt:admin.updatedAt});
const checkpoint=readLocal(checkpointName);
assert.equal(admin.businessHash,checkpoint.businessHash,'Admin business fields changed since handoff audit checkpoint');
assert.equal(admin.strictHash,checkpoint.strictHash,'Admin row changed since handoff audit checkpoint');
const evidence={measuredAt:new Date().toISOString(),table:'users',id:1,strictPreservation:'FAIL',
  fields:[
    {field:'last_login_at',current:admin.lastLoginAt,before:null,verdict:'EXPECTED_LOGIN_METADATA_CHANGE; historical before value unavailable',cause:'AuthServiceImpl.login: setLastLoginAt(LocalDateTime.now())'},
    {field:'updated_at',current:admin.updatedAt,before:null,verdict:'EXPECTED_LOGIN_METADATA_CHANGE; historical before value unavailable',cause:'User.updatedAt: Hibernate @UpdateTimestamp'},
    ...['id','email','password_hash','full_name','phone','role','status','created_at'].map(field=>({field,verdict:'HISTORICAL_FIELD_COMPARISON_UNAVAILABLE; no per-column baseline'})),
  ],
  originalBusinessComparison:{status:'PARTIAL_PASS',exactOriginalRows:originalRows-1,totalOriginalRows:originalRows,excludedRow:{table:'users',id:1,status:'INCONCLUSIVE',reason:'Original baseline has only whole-row hash; cannot derive historical business-only digest or per-field before values'}},
  adminCurrentCheckpoint:{status:'PASS',baselineAt:checkpoint.measuredAt,scope:'Current Admin row and business digest stable since this handoff checkpoint; not a pre-seed baseline'},
  causeAssessment:'Initial task devAdmin authentication is evidenced by executed seed code and source. Attribution to login metadata is an inference, not a complete historical per-field proof.',
  unexpectedBusinessChanges:'No evidence found; cannot exclude changes within historical Admin row from a whole-row hash alone',
  strictComparatorUnchanged:true,noDatabaseWrites:true};
writeLocal('manual-final-admin-audit.json',evidence);console.log(JSON.stringify(evidence));
