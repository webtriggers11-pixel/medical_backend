# FEATURE_PLAN — Unique Display ID Generation
> Created: 2026-05-31

---

## 1. Impact map

### New files (backend)
| File | Purpose |
|------|---------|
| `src/common/id-sequence/id-sequence.service.ts` | Shared utility — `generate(prefix, tx)` |
| `src/common/id-sequence/id-sequence.module.ts` | NestJS module, exported |

### Modified files (backend)
| File | Change |
|------|--------|
| `prisma/schema.prisma` | + `IdSequence` model; + `displayId String? @unique` on 9 models |
| `prisma/seed.ts` | + seed 9 `IdSequence` rows; + backfill helper (logs, not blocking) |
| `src/app.module.ts` | Import `IdSequenceModule` |
| `src/modules/zone/zone.service.ts` | `create()` generates Z-prefix displayId |
| `src/modules/city/city.service.ts` | `create()` generates CT-prefix displayId |
| `src/modules/store/store.service.ts` | `create()` generates S-prefix displayId |
| `src/modules/lab/lab.service.ts` | `create()` generates L-prefix displayId |
| `src/modules/panel/panel.service.ts` | `create()` generates P-prefix displayId |
| `src/modules/test-master/test-master.service.ts` | `create()` generates T-prefix displayId |
| `src/modules/users/users.service.ts` | `create()` generates CL-prefix displayId |
| `src/modules/candidates/candidates.service.ts` | `create()` + bulk `create()` generate C-prefix displayId |
| `src/modules/booking/booking.service.ts` | `create()` generates B-prefix displayId |

### Modified files (frontend) — minor additions only
| File | Change |
|------|--------|
| `src/types/user.types.ts` | Add `displayId?: string \| null` to `UserRecord` |
| `src/types/panel.types.ts` | Add `displayId?: string \| null` to `Panel` |
| `src/types/testMaster.types.ts` | Add `displayId?: string \| null` to `TestMaster` |
| `src/types/candidate.types.ts` | Add `displayId?: string \| null` |
| `src/types/booking.types.ts` | Add `displayId?: string \| null` |
| `src/types/org.types.ts` | Add `displayId?: string \| null` to Zone, City, Store |
| `src/types/lab.types.ts` | Add `displayId?: string \| null` to Lab |
| `src/pages/admin/ClientsPage.tsx` | Show `displayId` column |
| `src/pages/admin/ClientDetailPage.tsx` | Show `displayId` in header card |
| `src/pages/admin/ZonesPage.tsx` | Show `displayId` column |
| `src/pages/admin/CitiesPage.tsx` | Show `displayId` column |
| `src/pages/admin/ZoneCityPage.tsx` | Show `displayId` column |
| `src/pages/admin/StoresPage.tsx` | Show `displayId` column |
| `src/pages/admin/LabsPage.tsx` | Show `displayId` column |
| `src/pages/admin/PanelsPage.tsx` | Show `displayId` column |
| `src/pages/admin/TestMasterPage.tsx` | Show `displayId` column |
| `src/pages/admin/BookingRequestsPage.tsx` | Show `displayId` column |
| `src/pages/candidates/CandidatesPage.tsx` | Show `displayId` column |
| `src/pages/candidates/CandidateDetailPage.tsx` | Show `displayId` in header |

### Files NOT touched
- Any DTO files — `displayId` is never in request bodies
- Auth module / JWT / guards
- Report module
- `ClientPanelPricing`, `PanelTest`, `BookingScheduleChange` — join/audit tables, no displayId

---

## 2. DB migration plan

### Schema additions
```prisma
// New model
model IdSequence {
  prefix  String @id
  nextVal Int    @default(1)
  @@map("id_sequences")
}

// On each of 9 models — add one line:
displayId  String?  @unique
```

Run: `npx prisma db push` (consistent with existing approach — migration history has drift).

### Seed: 9 IdSequence rows
```ts
const prefixes = ['B','S','C','L','CL','P','T','Z','CT'];
for (const prefix of prefixes) {
  await prisma.idSequence.upsert({
    where: { prefix },
    create: { prefix, nextVal: 1 },
    update: {},   // never reset if already exists
  });
}
```

**Critical**: `nextVal` must start AFTER the count of existing records for that model so backfill and new creates don't collide. The seed calculates this:
```ts
const count = await prisma.booking.count();
await prisma.idSequence.upsert({
  where: { prefix: 'B' },
  create: { prefix: 'B', nextVal: count + 1 },
  update: {},
});
```

---

## 3. Shared IdSequenceService

`src/common/id-sequence/id-sequence.service.ts`:
```ts
@Injectable()
export class IdSequenceService {
  constructor(private prisma: PrismaService) {}

  // Call inside an existing $transaction — pass the tx client.
  async generate(
    prefix: string,
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  ): Promise<string> {
    const seq = await tx.idSequence.update({
      where: { prefix },
      data: { nextVal: { increment: 1 } },
      select: { nextVal: true },
    });
    return `${prefix}${String(seq.nextVal).padStart(3, '0')}`;
  }
}
```

**Why pass `tx`?** The displayId generation and the record creation must be in the same transaction. If the record create fails (e.g. unique constraint), the counter rolls back too.

---

## 4. Backend service pattern per module

Every service that currently has:
```ts
return this.prisma.zone.create({ data: { name, createdBy } });
```

Becomes:
```ts
return this.prisma.$transaction(async (tx) => {
  const displayId = await this.idSeq.generate('Z', tx);
  return tx.zone.create({ data: { name, createdBy, displayId } });
});
```

Services that **already use `$transaction`** (e.g. `panel.service.ts`): add the `generate()` call at the start of the existing transaction — no new nesting needed.

---

## 5. Frontend changes (display only)

**Type additions** — one field per type file:
```ts
displayId?: string | null;
```

**Listing pages** — add a compact ID chip as the first column:
```tsx
<td className="px-5 py-3.5">
  <span className="text-xs font-mono font-semibold text-slate-400">
    {row.displayId ?? '—'}
  </span>
</td>
```
Header: `<th>ID</th>` — narrow column, no sort needed.

**Detail pages** — add ID badge next to the title/name:
```tsx
{client.displayId && (
  <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">
    {client.displayId}
  </span>
)}
```

---

## 6. Conventions

- `IdSequenceService` is a shared utility — imported via `IdSequenceModule` which is `@Global()` so it doesn't need to be imported by every feature module
- Increment is inside `$transaction` — atomic, rollback-safe
- `displayId` is never in any DTO (CreateDto, UpdateDto) — server-only generated
- All existing `select` and `include` objects for the 9 models must include `displayId: true`
- Frontend renders `displayId ?? '—'` — never throws on null

---

## 7. Rollback plan

1. Remove `displayId` from 9 models in schema + remove `IdSequence` model
2. `prisma db push` — drops the `id_sequences` table + removes `displayId` columns
3. Delete `src/common/id-sequence/`
4. Revert 9 service `create()` methods (remove `$transaction` wrapper where added)
5. Revert frontend type files and UI columns
6. No existing data is lost — `displayId` was additive

---

## 8. Task breakdown

| Phase | Tasks |
|-------|-------|
| Data | UID-01: Schema + db push + seed IdSequence rows |
| Backend | UID-02: IdSequenceService shared utility + AppModule |
| Backend | UID-03: Zone + City services |
| Backend | UID-04: Store + Lab services |
| Backend | UID-05: Panel + TestMaster services |
| Backend | UID-06: Users (client) + Candidates services |
| Backend | UID-07: Booking service |
| Frontend | UID-08: Type file updates (all 9 types) |
| Frontend | UID-09: Admin listing pages (Clients, Zones, Labs, Panels, Tests, Bookings) |
| Frontend | UID-10: User-facing pages (Candidates, Stores) + detail cards |

---

## 9. Testing strategy

- Backend compile: `npx tsc -p tsconfig.json --noEmit` after UID-07
- Frontend compile: `npx tsc -b --noEmit` after UID-10
- Manual: create one record per module → verify displayId appears in list and detail
- Concurrency: not testable manually — covered by atomic DB increment design

---

## 10. CODEBASE.md sections to update

- Section 4 (DB schema): add IdSequence, displayId fields on 9 models
- Section 5 (modules): add id-sequence under common/
- Section 9 (key files): add IdSequenceService path
