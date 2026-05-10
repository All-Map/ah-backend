import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import {
  ApprovePayoutDto,
  MarkPayoutPaidDto,
  RejectPayoutDto,
  RequestPayoutDto,
} from './dto/payout.dto';

const MIN_PAYOUT_AMOUNT = 35; // can't request a payout below one commission

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── AGENT-FACING ─────────────────────────────────────────────

  /**
   * Aggregate commission balance for an agent — split into pending (in hold),
   * available (payable now), reserved (in a payout request), and lifetime paid.
   * Also returns the agent's verified payout destination on file so the UI can
   * default to it when requesting a payout.
   */
  async getAgentSummary(agentId: string) {
    const [groups, agent] = await Promise.all([
      this.prisma.agentCommission.groupBy({
        by: ['status'],
        where: { agentId },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.user.findUnique({
        where: { id: agentId },
        select: { payoutMethod: true, payoutDetails: true },
      }),
    ]);

    const totals = {
      pending: 0,
      available: 0,
      reserved: 0,
      paid: 0,
      voided: 0,
    } as Record<string, number>;

    const counts = { ...totals };

    for (const g of groups) {
      totals[g.status] = Number(g._sum.amount ?? 0);
      counts[g.status] = g._count;
    }

    return {
      currency: 'GHS',
      pendingAmount: totals.pending,
      availableAmount: totals.available,
      reservedAmount: totals.reserved,
      paidAmount: totals.paid,
      lifetimeEarned: totals.pending + totals.available + totals.reserved + totals.paid,
      counts,
      verifiedPayoutMethod: agent?.payoutMethod ?? null,
      verifiedPayoutDetails: agent?.payoutDetails ?? null,
    };
  }

  async listAgentCommissions(agentId: string, limit = 50) {
    return this.prisma.agentCommission.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        booking: {
          select: {
            id: true,
            studentName: true,
            checkInDate: true,
            hostel: { select: { id: true, name: true } },
          },
        },
        payout: { select: { id: true, status: true, paidAt: true } },
      },
    });
  }

  async listAgentPayouts(agentId: string) {
    return this.prisma.agentPayout.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      include: {
        commissions: {
          select: { id: true, amount: true, bookingId: true },
        },
      },
    });
  }

  /**
   * Bundle all currently-available commissions for the agent into a payout request.
   * Marks each commission as "reserved" so it can't be double-claimed.
   *
   * If the DTO doesn't include method/destination, falls back to the agent's
   * verified payout details on the User record (set during verification approval).
   */
  async requestPayout(agentId: string, dto: RequestPayoutDto) {
    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      select: { payoutMethod: true, payoutDetails: true },
    });

    const method = dto.method ?? agent?.payoutMethod;
    const destination = dto.destination ?? (agent?.payoutDetails as Record<string, any> | null);

    if (!method) {
      throw new BadRequestException(
        'No payout method on file. Submit your payment details via verification first.',
      );
    }
    if (!destination || Object.keys(destination).length === 0) {
      throw new BadRequestException(
        'No payout destination on file. Submit your payment details via verification first.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const eligible = await tx.agentCommission.findMany({
        where: {
          agentId,
          status: 'available',
        },
        select: { id: true, amount: true },
      });

      const total = eligible.reduce((sum, c) => sum + Number(c.amount), 0);

      if (eligible.length === 0 || total < MIN_PAYOUT_AMOUNT) {
        throw new BadRequestException(
          `No available commissions to pay out. Minimum payout is GHS ${MIN_PAYOUT_AMOUNT}.`,
        );
      }

      const payout = await tx.agentPayout.create({
        data: {
          agentId,
          amount: total,
          method,
          destination: destination as Prisma.InputJsonValue,
          status: 'requested',
          notes: dto.notes,
        },
      });

      await tx.agentCommission.updateMany({
        where: { id: { in: eligible.map((c) => c.id) } },
        data: { status: 'reserved', payoutId: payout.id },
      });

      return payout;
    });
  }

  // ─── SUPER-ADMIN-FACING ───────────────────────────────────────

  /**
   * Every commission ever credited (across all agents). Used by the super-admin
   * commissions tab so they can see what each agent has earned, including
   * still-in-hold and voided records.
   */
  async listAllCommissions(filters: { status?: string; agentId?: string } = {}) {
    const commissions = await this.prisma.agentCommission.findMany({
      where: {
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.agentId ? { agentId: filters.agentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        booking: {
          select: {
            id: true,
            studentName: true,
            checkInDate: true,
            hostel: { select: { id: true, name: true } },
          },
        },
        payout: { select: { id: true, status: true, paidAt: true } },
      },
    });

    const agentIds = Array.from(new Set(commissions.map((c) => c.agentId)));
    const agents = await this.prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(agents.map((a) => [a.id, a]));

    return commissions.map((c) => ({ ...c, agent: byId.get(c.agentId) ?? null }));
  }

  /**
   * Roll-up of every hostel that has earned commissions, including weekly
   * booking activity. Powers the super-admin "By Hostel" tab.
   */
  async getCommissionsByHostel() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 1. Group commissions by (hostelId, status) → amount + count
    const grouped = await this.prisma.agentCommission.groupBy({
      by: ['hostelId', 'status'],
      _sum: { amount: true },
      _count: true,
    });

    if (grouped.length === 0) return [];

    const hostelIds = Array.from(new Set(grouped.map((g) => g.hostelId)));

    // 2. Bookings counts (lifetime + this week) per hostel — single query each
    const [bookingsTotal, bookingsThisWeek, hostels] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['hostelId'],
        where: { hostelId: { in: hostelIds } },
        _count: true,
      }),
      this.prisma.booking.groupBy({
        by: ['hostelId'],
        where: { hostelId: { in: hostelIds }, createdAt: { gte: weekAgo } },
        _count: true,
      }),
      this.prisma.hostel.findMany({
        where: { id: { in: hostelIds } },
        select: {
          id: true, name: true, address: true, isVerified: true,
          adminId: true,
        },
      }),
    ]);

    const totalByHostel = new Map(bookingsTotal.map((b) => [b.hostelId, b._count]));
    const weekByHostel = new Map(bookingsThisWeek.map((b) => [b.hostelId, b._count]));
    const hostelById = new Map(hostels.map((h) => [h.id, h]));

    // 3. Resolve agent users for each hostel
    const adminIds = Array.from(new Set(hostels.map((h) => h.adminId).filter(Boolean)));
    const agents = await this.prisma.user.findMany({
      where: { id: { in: adminIds as string[] } },
      select: { id: true, name: true, email: true, phone: true, payoutMethod: true },
    });
    const agentById = new Map(agents.map((a) => [a.id, a]));

    // 4. Stitch it all together
    const rollup = new Map<string, any>();
    for (const g of grouped) {
      const h = hostelById.get(g.hostelId);
      if (!h) continue;

      let entry = rollup.get(g.hostelId);
      if (!entry) {
        entry = {
          hostelId: g.hostelId,
          hostelName: h.name,
          hostelAddress: h.address,
          isVerified: h.isVerified,
          agent: agentById.get(h.adminId) ?? null,
          bookingsThisWeek: weekByHostel.get(g.hostelId) ?? 0,
          bookingsTotal: totalByHostel.get(g.hostelId) ?? 0,
          commissions: {
            pending: 0,
            available: 0,
            reserved: 0,
            paid: 0,
            voided: 0,
          },
          counts: {
            pending: 0,
            available: 0,
            reserved: 0,
            paid: 0,
            voided: 0,
          },
          totalEarned: 0,
        };
        rollup.set(g.hostelId, entry);
      }

      const amount = Number(g._sum.amount ?? 0);
      entry.commissions[g.status] = amount;
      entry.counts[g.status] = g._count;
      if (g.status !== 'voided') entry.totalEarned += amount;
    }

    // Sort: most weekly bookings first, then highest pending commission
    return Array.from(rollup.values()).sort((a, b) => {
      if (b.bookingsThisWeek !== a.bookingsThisWeek) {
        return b.bookingsThisWeek - a.bookingsThisWeek;
      }
      return (
        b.commissions.pending +
        b.commissions.available -
        (a.commissions.pending + a.commissions.available)
      );
    });
  }

  /**
   * Force a pending commission to available immediately, bypassing the hold window.
   */
  async releaseCommission(commissionId: string, reviewerId: string) {
    const commission = await this.prisma.agentCommission.findUnique({
      where: { id: commissionId },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.status !== 'pending') {
      throw new BadRequestException(
        `Cannot release commission in status: ${commission.status}`,
      );
    }

    return this.prisma.agentCommission.update({
      where: { id: commissionId },
      data: {
        status: 'available',
        availableAt: new Date(),
        notes: commission.notes
          ? `${commission.notes}\nManually released by super-admin ${reviewerId}`
          : `Manually released by super-admin ${reviewerId}`,
      },
    });
  }

  /**
   * Void a pending or available commission (e.g. fraud, duplicate booking).
   */
  async voidCommission(commissionId: string, reviewerId: string, reason: string) {
    const commission = await this.prisma.agentCommission.findUnique({
      where: { id: commissionId },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (!['pending', 'available'].includes(commission.status)) {
      throw new BadRequestException(
        `Cannot void commission in status: ${commission.status}`,
      );
    }

    return this.prisma.agentCommission.update({
      where: { id: commissionId },
      data: {
        status: 'voided',
        notes: `Voided by super-admin ${reviewerId}: ${reason}`,
      },
    });
  }


  async listAllPayouts(filters: {
    status?: string;
    agentId?: string;
    method?: 'momo' | 'bank';
    minAmount?: number;
    maxAmount?: number;
    from?: string;
    to?: string;
    search?: string;
  } = {}) {
    const where: Prisma.AgentPayoutWhereInput = {
      ...(filters.status ? { status: filters.status as any } : {}),
      ...(filters.agentId ? { agentId: filters.agentId } : {}),
      ...(filters.method ? { method: filters.method } : {}),
      ...(filters.minAmount != null || filters.maxAmount != null
        ? {
            amount: {
              ...(filters.minAmount != null ? { gte: filters.minAmount } : {}),
              ...(filters.maxAmount != null ? { lte: filters.maxAmount } : {}),
            },
          }
        : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const payouts = await this.prisma.agentPayout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        commissions: {
          select: {
            id: true,
            amount: true,
            booking: { select: { id: true, studentName: true } },
          },
        },
      },
    });

    // Enrich with agent identity + verified payout method (single batch query)
    const agentIds = Array.from(new Set(payouts.map((p) => p.agentId)));
    const agents = await this.prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: {
        id: true, name: true, email: true, phone: true,
        payoutMethod: true, payoutDetails: true,
      },
    });
    const byId = new Map(agents.map((a) => [a.id, a]));
    let enriched = payouts.map((p) => ({ ...p, agent: byId.get(p.agentId) ?? null }));

    // Free-text search (post-fetch — small payout volume keeps this cheap)
    if (filters.search) {
      const q = filters.search.toLowerCase();
      enriched = enriched.filter((p) => {
        const a = p.agent;
        return (
          a?.name?.toLowerCase().includes(q) ||
          a?.email?.toLowerCase().includes(q) ||
          a?.phone?.toLowerCase().includes(q) ||
          p.transactionRef?.toLowerCase().includes(q)
        );
      });
    }

    return enriched;
  }

  /**
   * Bulk-approve a set of payout requests. Skips any not in 'requested' state.
   * Returns counts so the UI can report what happened.
   */
  async bulkApprove(payoutIds: string[], reviewerId: string) {
    if (!payoutIds.length) {
      throw new BadRequestException('No payouts selected');
    }

    const result = await this.prisma.agentPayout.updateMany({
      where: { id: { in: payoutIds }, status: 'requested' },
      data: {
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });

    return { approved: result.count, requested: payoutIds.length };
  }

  /**
   * Bulk-mark-paid: tag every selected payout (and its commissions) as paid
   * with a single batch reference. Use this AFTER you've actually sent the
   * money via Paystack/MoMo/bank.
   */
  async bulkMarkPaid(
    payoutIds: string[],
    batchReference: string,
    reviewerId: string,
    notes?: string,
  ) {
    if (!payoutIds.length) {
      throw new BadRequestException('No payouts selected');
    }
    if (!batchReference || batchReference.trim().length === 0) {
      throw new BadRequestException('Batch transaction reference is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // Only mark eligible payouts paid (must be 'requested' or 'approved')
      const eligible = await tx.agentPayout.findMany({
        where: { id: { in: payoutIds }, status: { in: ['requested', 'approved'] } },
        select: { id: true, reviewedBy: true, reviewedAt: true, notes: true },
      });

      const eligibleIds = eligible.map((p) => p.id);
      if (eligibleIds.length === 0) {
        return { paid: 0, requested: payoutIds.length };
      }

      // Mark commissions paid
      await tx.agentCommission.updateMany({
        where: { payoutId: { in: eligibleIds }, status: 'reserved' },
        data: { status: 'paid', paidOutAt: now },
      });

      // Mark payouts paid (with the shared batch ref)
      await tx.agentPayout.updateMany({
        where: { id: { in: eligibleIds } },
        data: {
          status: 'paid',
          paidAt: now,
          transactionRef: batchReference,
          // Don't overwrite reviewedBy/reviewedAt if already set
        },
      });

      // Backfill reviewer/timestamp on payouts that hadn't been approved yet
      await tx.agentPayout.updateMany({
        where: { id: { in: eligibleIds }, reviewedBy: null },
        data: { reviewedBy: reviewerId, reviewedAt: now },
      });

      // Append batch note (best-effort — only if notes provided)
      if (notes) {
        for (const p of eligible) {
          await tx.agentPayout.update({
            where: { id: p.id },
            data: { notes: p.notes ? `${p.notes}\n[batch] ${notes}` : `[batch] ${notes}` },
          });
        }
      }

      return { paid: eligibleIds.length, requested: payoutIds.length };
    });
  }

  async getPayoutById(payoutId: string) {
    const payout = await this.prisma.agentPayout.findUnique({
      where: { id: payoutId },
      include: {
        commissions: {
          include: {
            booking: { select: { id: true, studentName: true, hostel: { select: { name: true } } } },
          },
        },
      },
    });

    if (!payout) throw new NotFoundException('Payout not found');

    const agent = await this.prisma.user.findUnique({
      where: { id: payout.agentId },
      select: {
        id: true, name: true, email: true, phone: true,
        payoutMethod: true, payoutDetails: true,
      },
    });

    return { ...payout, agent };
  }

  /**
   * Snapshot of commissions and payouts across all agents — for super-admin overview.
   */
  async getOverview() {
    const [
      totalEarnedAgg,
      totalPaidAgg,
      pendingPayoutsAgg,
      payoutsByStatus,
    ] = await Promise.all([
      this.prisma.agentCommission.aggregate({
        _sum: { amount: true },
        where: { status: { in: ['pending', 'available', 'reserved', 'paid'] } },
      }),
      this.prisma.agentCommission.aggregate({
        _sum: { amount: true },
        where: { status: 'paid' },
      }),
      this.prisma.agentPayout.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: { in: ['requested', 'approved'] } },
      }),
      this.prisma.agentPayout.groupBy({
        by: ['status'],
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    return {
      currency: 'GHS',
      totalCommissionsEarned: Number(totalEarnedAgg._sum.amount ?? 0),
      totalCommissionsPaid: Number(totalPaidAgg._sum.amount ?? 0),
      pendingPayoutsCount: pendingPayoutsAgg._count,
      pendingPayoutsAmount: Number(pendingPayoutsAgg._sum.amount ?? 0),
      payoutsByStatus: payoutsByStatus.map((p) => ({
        status: p.status,
        count: p._count,
        amount: Number(p._sum.amount ?? 0),
      })),
    };
  }

  async approvePayout(payoutId: string, reviewerId: string, dto: ApprovePayoutDto) {
    const payout = await this.prisma.agentPayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== 'requested') {
      throw new BadRequestException(`Cannot approve payout in status: ${payout.status}`);
    }

    return this.prisma.agentPayout.update({
      where: { id: payoutId },
      data: {
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        notes: dto.notes ?? payout.notes,
      },
    });
  }

  async rejectPayout(payoutId: string, reviewerId: string, dto: RejectPayoutDto) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.agentPayout.findUnique({ where: { id: payoutId } });
      if (!payout) throw new NotFoundException('Payout not found');
      if (!['requested', 'approved'].includes(payout.status)) {
        throw new BadRequestException(`Cannot reject payout in status: ${payout.status}`);
      }

      // Release reserved commissions back to available
      await tx.agentCommission.updateMany({
        where: { payoutId, status: 'reserved' },
        data: { status: 'available', payoutId: null },
      });

      return tx.agentPayout.update({
        where: { id: payoutId },
        data: {
          status: 'rejected',
          rejectionReason: dto.reason,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        },
      });
    });
  }

  async markPayoutPaid(payoutId: string, reviewerId: string, dto: MarkPayoutPaidDto) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.agentPayout.findUnique({ where: { id: payoutId } });
      if (!payout) throw new NotFoundException('Payout not found');
      if (!['approved', 'requested'].includes(payout.status)) {
        throw new BadRequestException(`Cannot mark paid — payout is ${payout.status}`);
      }

      const now = new Date();

      await tx.agentCommission.updateMany({
        where: { payoutId, status: 'reserved' },
        data: { status: 'paid', paidOutAt: now },
      });

      return tx.agentPayout.update({
        where: { id: payoutId },
        data: {
          status: 'paid',
          paidAt: now,
          transactionRef: dto.transactionRef,
          reviewedBy: payout.reviewedBy ?? reviewerId,
          reviewedAt: payout.reviewedAt ?? now,
          notes: dto.notes ?? payout.notes,
        },
      });
    });
  }

  // ─── BACKGROUND JOB ───────────────────────────────────────────

  /**
   * Promote pending commissions to available once their hold window has elapsed.
   * Runs hourly.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async releasePendingCommissions() {
    const result = await this.prisma.agentCommission.updateMany({
      where: {
        status: 'pending',
        availableAt: { lte: new Date() },
      },
      data: { status: 'available' },
    });

    if (result.count > 0) {
      console.log(`[commissions] Released ${result.count} pending commissions to available`);
    }
  }
}
