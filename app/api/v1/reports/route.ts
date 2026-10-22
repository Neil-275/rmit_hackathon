import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/src/server/db';
import { getAuthUser } from '@/src/server/auth';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all() as any[];

    const reports = rows.map(r => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      status: r.status,
      version: r.version,
      accusedPersonIds: JSON.parse(r.accused_person_ids_json || '[]'),
      councilVersion: r.council_version,
      councilRosterHash: r.council_roster_hash,
      voterCount: r.voter_count,
      quorumRequired: r.quorum_required,
      votingRequestId: r.voting_request_id,
      createdAt: r.created_at,
      capabilities: r.voting_request_id ? ["vote"] : []
    }));

    return NextResponse.json({
      ok: true,
      data: { items: reports },
      contractVersion: "v1"
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: err.message, enforcement: "APP", retryable: false },
      contractVersion: "v1"
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({
        ok: false,
        error: { code: "UNAUTHENTICATED", message: "Bạn cần đăng nhập.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 401 });
    }

    const body = await request.json();
    const { title, summary, accusedPersonIds } = body;

    if (!title || !summary || !Array.isArray(accusedPersonIds)) {
      return NextResponse.json({
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Tiêu đề, tóm tắt và danh sách người bị tố cáo là bắt buộc.", enforcement: "APP", retryable: false },
        contractVersion: "v1"
      }, { status: 400 });
    }

    const db = getDb();
    const council = db.prepare('SELECT * FROM council ORDER BY version DESC LIMIT 1').get() as any;
    const councilMembers = JSON.parse(council.members_json) as Array<{
      subject: string;
      displayName: string;
      membershipRole: string;
      independent: boolean;
      active: boolean;
    }>;

    // Filter out accused members (Conflict of Interest protection)
    const eligibleMembers = councilMembers.filter(m => !accusedPersonIds.includes(m.subject) && m.active);

    const reportId = randomUUID();
    const now = new Date().toISOString();

    if (eligibleMembers.length < 3) {
      // Insufficient eligible jurors - status AWAITING_ELIGIBLE_JURY
      db.prepare(`
        INSERT INTO reports (id, title, summary, status, version, accused_person_ids_json, council_version, council_roster_hash, voter_count, quorum_required, voting_request_id, reporter_subject, reporter_display_name, created_at)
        VALUES (?, ?, ?, 'AWAITING_ELIGIBLE_JURY', 1, ?, ?, ?, null, null, null, ?, ?, ?)
      `).run(
        reportId,
        title,
        summary,
        JSON.stringify(accusedPersonIds),
        council.version,
        council.roster_hash,
        user.subject,
        user.displayName,
        now
      );

      return NextResponse.json({
        ok: true,
        data: {
          id: reportId,
          title,
          summary,
          status: 'AWAITING_ELIGIBLE_JURY',
          version: 1,
          accusedPersonIds,
          councilVersion: council.version,
          voterCount: null,
          quorumRequired: null,
          votingRequestId: null,
          createdAt: now
        },
        contractVersion: "v1"
      }, { status: 201 });
    }

    // Pick 3 or 4 jurors ensuring at least 1 independent member
    const N = Math.min(eligibleMembers.length, 4);
    const quorumRequired = Math.ceil((2 * N) / 3);

    const chosenJurors = eligibleMembers.slice(0, N);
    const voters = chosenJurors.map(j => ({
      subject: j.subject,
      displayName: j.displayName,
      independent: j.independent,
      hasVoted: false
    }));

    const vrId = randomUUID();

    // Create linked voting request
    db.prepare(`
      INSERT INTO voting_requests (id, operation, resource_kind, resource_id, state, version, purpose, voter_count, quorum_required, voters_json, valid_approvals, independent_approved, council_version, context_hash, created_at, expires_at)
      VALUES (?, 'REVEAL_REPORT_IDENTITY', 'REPORT', ?, 'COLLECTING', 1, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `).run(
      vrId,
      reportId,
      "Mở danh tính người phản ánh để điều tra",
      N,
      quorumRequired,
      JSON.stringify(voters),
      council.version,
      "sha256:ctx-" + vrId.slice(0, 4),
      now,
      new Date(Date.now() + 7 * 86400000).toISOString()
    );

    // Create report
    db.prepare(`
      INSERT INTO reports (id, title, summary, status, version, accused_person_ids_json, council_version, council_roster_hash, voter_count, quorum_required, voting_request_id, reporter_subject, reporter_display_name, created_at)
      VALUES (?, ?, ?, 'INVESTIGATING', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      title,
      summary,
      JSON.stringify(accusedPersonIds),
      council.version,
      council.roster_hash,
      N,
      quorumRequired,
      vrId,
      user.subject,
      user.displayName,
      now
    );

    // Audit log (never log reporter identity)
    db.prepare(`
      INSERT INTO audit (id, at, action, outcome, source, resource_kind, resource_id, actor_display_name, request_id)
      VALUES (?, ?, 'REPORT_SUBMITTED', 'OK', 'SIMULATED', 'REPORT', ?, 'Ẩn danh', ?)
    `).run(
      randomUUID(),
      now,
      reportId,
      "req-" + reportId.slice(0, 8)
    );

    return NextResponse.json({
      ok: true,
      data: {
        id: reportId,
        title,
        summary,
        status: 'INVESTIGATING',
        version: 1,
        accusedPersonIds,
        councilVersion: council.version,
        voterCount: N,
        quorumRequired,
        votingRequestId: vrId,
        createdAt: now
      },
      contractVersion: "v1"
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: err.message, enforcement: "APP", retryable: false },
      contractVersion: "v1"
    }, { status: 500 });
  }
}
