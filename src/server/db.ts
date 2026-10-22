import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'voicevault.db');

let _db: Database.Database | null = null;
let _prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');

  initSchema(_db);
  seedIfEmpty(_db);

  return _db;
}

export interface DbUser {
  id: string;
  subject: string;
  username: string;
  displayName: string;
  email?: string | null;
  roles: string[];
  department?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getUserBySubject(subject: string): DbUser | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE subject = ?').get(subject) as any;
  if (!row) return null;
  return {
    id: row.id,
    subject: row.subject,
    username: row.username,
    displayName: row.displayName,
    email: row.email,
    roles: JSON.parse(row.rolesJson || '["employee"]'),
    department: row.department,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function getAllUsers(): DbUser[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM users ORDER BY displayName ASC').all() as any[];
  return rows.map(row => ({
    id: row.id,
    subject: row.subject,
    username: row.username,
    displayName: row.displayName,
    email: row.email,
    roles: JSON.parse(row.rolesJson || '["employee"]'),
    department: row.department,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

export function upsertUser(user: {
  subject: string;
  username: string;
  displayName: string;
  roles: string[];
  email?: string;
  department?: string;
}): DbUser {
  const db = getDb();
  const existing = getUserBySubject(user.subject);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE users
      SET displayName = ?, rolesJson = ?, email = COALESCE(?, email), department = COALESCE(?, department), updatedAt = ?
      WHERE subject = ?
    `).run(
      user.displayName,
      JSON.stringify(user.roles),
      user.email || null,
      user.department || null,
      now,
      user.subject
    );
    return getUserBySubject(user.subject)!;
  } else {
    const id = "usr-" + Math.random().toString(36).substring(2, 10);
    db.prepare(`
      INSERT INTO users (id, subject, username, displayName, email, rolesJson, department, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      user.subject,
      user.username,
      user.displayName,
      user.email || null,
      JSON.stringify(user.roles),
      user.department || 'General',
      now,
      now
    );
    return getUserBySubject(user.subject)!;
  }
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      displayName TEXT NOT NULL,
      email TEXT,
      rolesJson TEXT NOT NULL DEFAULT '["employee"]',
      department TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      version INTEGER NOT NULL,
      endorsement_count INTEGER NOT NULL DEFAULT 0,
      publish_credit_on_approval INTEGER NOT NULL DEFAULT 1,
      public_credit_json TEXT,
      decision_reason TEXT,
      author_subject TEXT NOT NULL,
      author_display_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      version INTEGER NOT NULL,
      accused_person_ids_json TEXT NOT NULL,
      council_version INTEGER NOT NULL,
      council_roster_hash TEXT NOT NULL,
      voter_count INTEGER,
      quorum_required INTEGER,
      voting_request_id TEXT,
      reporter_subject TEXT NOT NULL,
      reporter_display_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voting_requests (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      resource_kind TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      state TEXT NOT NULL,
      version INTEGER NOT NULL,
      purpose TEXT NOT NULL,
      voter_count INTEGER NOT NULL,
      quorum_required INTEGER NOT NULL,
      voters_json TEXT NOT NULL,
      valid_approvals INTEGER NOT NULL DEFAULT 0,
      independent_approved INTEGER NOT NULL DEFAULT 0,
      council_version INTEGER NOT NULL,
      context_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS council (
      version INTEGER PRIMARY KEY,
      roster_hash TEXT NOT NULL,
      members_json TEXT NOT NULL,
      selection_policy_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY,
      at TEXT NOT NULL,
      action TEXT NOT NULL,
      outcome TEXT NOT NULL,
      source TEXT NOT NULL,
      resource_kind TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      actor_display_name TEXT,
      request_id TEXT NOT NULL
    );
  `);
}

function seedIfEmpty(db: Database.Database) {
  // Seed Users
  const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCountRow.count === 0) {
    const seedUsers = [
      { subject: "subject-an", username: "an", displayName: "An", roles: ["employee"], department: "Engineering", email: "an@voicevault.internal" },
      { subject: "subject-chi", username: "chi", displayName: "Chi", roles: ["employee", "director"], department: "Executive", email: "chi@voicevault.internal" },
      { subject: "subject-minh", username: "minh", displayName: "Minh", roles: ["employee", "manager"], department: "Operations", email: "minh@voicevault.internal" },
      { subject: "subject-binh", username: "binh", displayName: "Bình", roles: ["employee", "juror"], department: "Legal", email: "binh@voicevault.internal" },
      { subject: "subject-dung", username: "dung", displayName: "Dũng", roles: ["employee", "juror"], department: "Finance", email: "dung@voicevault.internal" },
      { subject: "subject-hoa", username: "hoa", displayName: "Hoa", roles: ["employee", "juror"], department: "Internal Audit", email: "hoa@voicevault.internal" },
      { subject: "subject-khanh", username: "khanh", displayName: "Khánh", roles: ["employee", "juror"], department: "People & Culture", email: "khanh@voicevault.internal" },
      { subject: "subject-lan", username: "lan", displayName: "Lan", roles: ["employee", "juror"], department: "External Independent", email: "lan@voicevault.internal" },
      { subject: "an_nguyen", username: "an_nguyen", displayName: "An Nguyễn", roles: ["offline_access", "employee"], department: "Engineering", email: "an.nguyen@tidecloak.internal" },
    ];

    const insertUser = db.prepare(`
      INSERT INTO users (id, subject, username, displayName, email, rolesJson, department, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    for (const u of seedUsers) {
      insertUser.run(
        "usr-" + u.username,
        u.subject,
        u.username,
        u.displayName,
        u.email,
        JSON.stringify(u.roles),
        u.department,
        now,
        now
      );
    }
  }

  // Seed Council
  const councilRow = db.prepare('SELECT COUNT(*) as count FROM council').get() as { count: number };
  if (councilRow.count > 0) return;

  const COUNCIL_VERSION = 3;
  const ROSTER_HASH = "sha256:7f3a9c1e0b5d4f2a8c6e1d9b3f7a5c2e4d6b8f0a1c3e5d7f9b2a4c6e8d0f1a3b";

  const councilMembers = [
    { subject: "subject-binh", displayName: "Bình", membershipRole: "CHAIR", independent: false, active: true },
    { subject: "subject-dung", displayName: "Dũng", membershipRole: "MEMBER", independent: false, active: true },
    { subject: "subject-hoa", displayName: "Hoa", membershipRole: "MEMBER", independent: true, active: true },
    { subject: "subject-khanh", displayName: "Khánh", membershipRole: "MEMBER", independent: false, active: true },
    { subject: "subject-lan", displayName: "Lan", membershipRole: "MEMBER", independent: true, active: true },
  ];

  db.prepare(`
    INSERT INTO council (version, roster_hash, members_json, selection_policy_json)
    VALUES (?, ?, ?, ?)
  `).run(
    COUNCIL_VERSION,
    ROSTER_HASH,
    JSON.stringify(councilMembers),
    JSON.stringify({ minVoters: 3, maxVoters: 5 })
  );

  // Ideas seed
  const insertIdea = db.prepare(`
    INSERT INTO ideas (id, title, description, category, status, version, endorsement_count, publish_credit_on_approval, public_credit_json, decision_reason, author_subject, author_display_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertIdea.run(
    "1dea0000-0000-4000-8000-000000000001",
    "Họp đứng 15 phút mỗi sáng",
    "Thay họp giao ban 1 giờ bằng họp đứng 15 phút.",
    "process",
    "UNDER_REVIEW",
    2,
    1,
    1,
    null,
    null,
    "subject-an",
    "An",
    "2026-10-22T01:00:00.000Z"
  );

  insertIdea.run(
    "1dea0000-0000-4000-8000-000000000002",
    "Kênh góp ý ẩn danh cho khách hàng nội bộ",
    "Mở form ẩn danh cho các phòng ban đánh giá dịch vụ IT.",
    "culture",
    "APPROVED",
    3,
    2,
    1,
    JSON.stringify({ displayName: "An", verified: false }),
    "Chi phí thấp, tác động rộng.",
    "subject-an",
    "An",
    "2026-10-21T08:00:00.000Z"
  );

  insertIdea.run(
    "1dea0000-0000-4000-8000-000000000003",
    "Bỏ chấm công bằng vân tay",
    "Dùng check-in qua app thay máy vân tay.",
    "tooling",
    "REJECTED",
    2,
    0,
    0,
    null,
    "Chưa đáp ứng yêu cầu kiểm toán.",
    "subject-an",
    "An",
    "2026-10-21T09:00:00.000Z"
  );

  // Voting Requests seed
  const insertVR = db.prepare(`
    INSERT INTO voting_requests (id, operation, resource_kind, resource_id, state, version, purpose, voter_count, quorum_required, voters_json, valid_approvals, independent_approved, council_version, context_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const vr1Voters = [
    { subject: "subject-binh", displayName: "Bình", independent: false, hasVoted: false },
    { subject: "subject-dung", displayName: "Dũng", independent: false, hasVoted: false },
    { subject: "subject-hoa", displayName: "Hoa", independent: true, hasVoted: false }
  ];
  insertVR.run(
    "70de0000-0000-4000-8000-000000000001",
    "REVEAL_REPORT_IDENTITY",
    "REPORT",
    "0e900000-0000-4000-8000-000000000002",
    "COLLECTING",
    1,
    "Mở danh tính người phản ánh để điều tra",
    3,
    2,
    JSON.stringify(vr1Voters),
    0,
    0,
    COUNCIL_VERSION,
    "sha256:ctx-0001",
    "2026-10-22T03:00:00.000Z",
    "2026-10-29T10:00:00.000Z"
  );

  // Reports seed
  const insertReport = db.prepare(`
    INSERT INTO reports (id, title, summary, status, version, accused_person_ids_json, council_version, council_roster_hash, voter_count, quorum_required, voting_request_id, reporter_subject, reporter_display_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertReport.run(
    "0e900000-0000-4000-8000-000000000001",
    "Áp lực làm thêm giờ không ghi nhận",
    "Nhóm bị yêu cầu làm thêm cuối tuần nhưng không ghi công.",
    "AWAITING_ELIGIBLE_JURY",
    1,
    JSON.stringify(["subject-binh", "subject-dung", "subject-hoa"]),
    COUNCIL_VERSION,
    ROSTER_HASH,
    null,
    null,
    null,
    "subject-an",
    "An",
    "2026-10-22T02:10:00.000Z"
  );

  insertReport.run(
    "0e900000-0000-4000-8000-000000000002",
    "Nghi vấn thiên vị trong đánh giá cuối năm",
    "Điểm đánh giá bị điều chỉnh sau khi đã chốt.",
    "INVESTIGATING",
    2,
    JSON.stringify(["subject-giang"]),
    COUNCIL_VERSION,
    ROSTER_HASH,
    3,
    2,
    "70de0000-0000-4000-8000-000000000001",
    "subject-an",
    "An",
    "2026-10-22T02:20:00.000Z"
  );

  // Audit seed
  const insertAudit = db.prepare(`
    INSERT INTO audit (id, at, action, outcome, source, resource_kind, resource_id, actor_display_name, request_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run(
    "a0000000-0000-4000-8000-000000000001",
    "2026-10-22T01:00:01.000Z",
    "IDEA_SUBMITTED",
    "OK",
    "SIMULATED",
    "IDEA",
    "1dea0000-0000-4000-8000-000000000001",
    "An",
    "req-sample-1"
  );
}
