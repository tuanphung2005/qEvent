import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { prisma } from "../src/plugins/prisma";
import { clusterSessionQuestions } from "../src/modules/realtime/services/qa-cluster.service";
import { AiInvalidOutputError, type JsonGenerator } from "../src/services/ai.service";

// Tạo session tạm riêng → không đụng dữ liệu seed. Không gọi mạng → tất định, không tốn quota.
describe("clusterSessionQuestions (fake generator)", () => {
  let sessionId = "";
  let userId = "";
  const ids: string[] = [];

  beforeAll(async () => {
    const event = await prisma.event.findFirst({ include: { rooms: { take: 1 } } });
    const user = await prisma.user.findFirst({ where: { role: "ATTENDEE" } });
    if (!event?.rooms[0] || !user) throw new Error("Cần DB đã seed trước khi chạy test");

    const session = await prisma.session.create({
      data: {
        eventId: event.id,
        roomId: event.rooms[0].id,
        title: `ai-cluster-test-${Date.now()}`,
        startTime: new Date(),
        endTime: new Date(Date.now() + 3_600_000),
      },
    });

    sessionId = session.id;
    userId = user.id;

    const created = await Promise.all(
      ["Khi nào ra mắt?", "Bao giờ launch?", "Giá bao nhiêu?"].map((content, i) =>
        prisma.qAQuestion.create({ data: { sessionId, userId, content, upvotes: i * 5 } })
      )
    );
    ids.push(...created.map((q) => q.id));
  });

  afterAll(async () => {
    await prisma.qAQuestion.deleteMany({ where: { id: { in: ids } } });
    if (sessionId) await prisma.session.delete({ where: { id: sessionId } });
  });

  it("ghi clusterId/clusterLabel/clusteredAt + tính mergedUpvotes ở server", async () => {
    const fake: JsonGenerator = async () => ({
      clusters: [
        { label: "Ra mắt", questionIds: [ids[0], ids[1]], representativeId: ids[1] },
        { label: "Giá", questionIds: [ids[2]], representativeId: ids[2] },
      ],
    });

    const result = await clusterSessionQuestions(sessionId, { generate: fake });

    expect(result.clusters).toHaveLength(2);
    expect(result.clusters[0]!.mergedUpvotes).toBe(5); // 0 + 5

    const rows = await prisma.qAQuestion.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((r) => [r.id, r]));

    expect(byId.get(ids[0]!)!.clusterId).toBe(result.clusters[0]!.id);
    expect(byId.get(ids[2]!)!.clusterLabel).toBe("Giá");
    expect(byId.get(ids[0]!)!.clusteredAt).toBeInstanceOf(Date);
  });

  it("lần gom thứ 2 thay thế hoàn toàn kết quả cũ (không còn nhóm 'ma')", async () => {
    // Reset clusteredAt để bypass cooldown trong test
    await prisma.qAQuestion.updateMany({
      where: { id: { in: ids } },
      data: { clusteredAt: null },
    });

    const fake: JsonGenerator = async () => ({
      clusters: [{ label: "Một nhóm", questionIds: ids, representativeId: ids[0] }],
    });

    const result = await clusterSessionQuestions(sessionId, { generate: fake });
    const rows = await prisma.qAQuestion.findMany({ where: { id: { in: ids } } });

    const clusterIds = new Set(rows.map((r) => r.clusterId));
    expect(clusterIds.size).toBe(1);
    expect(clusterIds.has(result.clusters[0]!.id)).toBe(true);
  });

  it("gom lại trong 5s → CLUSTER_COOLDOWN, không gọi model và không đổi DB", async () => {
    const select = { clusterId: true, clusterLabel: true, clusteredAt: true } as const;
    const before = await prisma.qAQuestion.findMany({
      where: { id: { in: ids } },
      orderBy: { id: "asc" },
      select,
    });

    const fake: JsonGenerator = async () => {
      throw new Error("không được gọi model khi còn cooldown");
    };
    await expect(clusterSessionQuestions(sessionId, { generate: fake })).rejects.toThrow(
      "CLUSTER_COOLDOWN"
    );

    const after = await prisma.qAQuestion.findMany({
      where: { id: { in: ids } },
      orderBy: { id: "asc" },
      select,
    });
    expect(after).toEqual(before);
  });

  it("output LLM rỗng → AiInvalidOutputError, DB không đổi", async () => {
    // clusteredAt cũ để cooldown không chặn; test này bắt lỗi mọi ghi DB trước khi validate.
    await prisma.qAQuestion.updateMany({
      where: { id: { in: ids } },
      data: { clusteredAt: new Date(Date.now() - 60_000) },
    });

    const select = { clusterId: true, clusterLabel: true, clusteredAt: true } as const;
    const before = await prisma.qAQuestion.findMany({
      where: { id: { in: ids } },
      orderBy: { id: "asc" },
      select,
    });

    const fake: JsonGenerator = async () => ({ clusters: [] });
    await expect(clusterSessionQuestions(sessionId, { generate: fake })).rejects.toThrow(
      AiInvalidOutputError
    );

    const after = await prisma.qAQuestion.findMany({
      where: { id: { in: ids } },
      orderBy: { id: "asc" },
      select,
    });
    expect(after).toEqual(before);
  });
});
